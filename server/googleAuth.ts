import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Missing required Google OAuth environment variables: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const baseUrl =
    process.env.GOOGLE_CALLBACK_URL?.replace(/\/(?:api\/)?auth\/google\/callback\/?$/, "") ||
    process.env.PUBLIC_URL ||
    process.env.BASE_URL ||
    `http://localhost:${process.env.PORT || 5000}`;

  const secureEnv = process.env.SESSION_COOKIE_SECURE;
  const secure =
    secureEnv === "true"
      ? true
      : secureEnv === "false"
        ? false
        : baseUrl.startsWith("https://");

  return session({
    secret: process.env.SESSION_SECRET || "fallback-secret-key-for-development-only",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure,
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Google OAuth strategy
  const callbackBase =
    process.env.GOOGLE_CALLBACK_URL?.replace(/\/(?:api\/)?auth\/google\/callback\/?$/, "") ||
    process.env.PUBLIC_URL ||
    process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const callbackURL = `${callbackBase.replace(/\/$/, "")}/api/auth/google/callback`;

  const actualCallbackURL = process.env.GOOGLE_CALLBACK_URL || callbackURL;

  // Debug logging - remove after fixing
  console.log("=== GOOGLE AUTH DEBUG ===");
  console.log("GOOGLE_CALLBACK_URL env:", process.env.GOOGLE_CALLBACK_URL);
  console.log("GOOGLE_CLIENT_ID env:", process.env.GOOGLE_CLIENT_ID ? "SET" : "NOT SET");
  console.log("Using callback URL:", actualCallbackURL);
  console.log("=========================");

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: actualCallbackURL
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      console.log("Google profile data:", {
        id: profile.id,
        email: profile.emails?.[0]?.value,
        firstName: profile.name?.givenName,
        lastName: profile.name?.familyName
      });

      // Extract user information from Google profile
      const userData = {
        id: profile.id,
        email: profile.emails?.[0]?.value || null,
        firstName: profile.name?.givenName || null,
        lastName: profile.name?.familyName || null,
        profileImageUrl: profile.photos?.[0]?.value || null,
      };

      console.log("Attempting to upsert user:", userData);

      // Check if user exists before upserting to detect first-time login
      const existingUser = await storage.getUser(profile.id);
      const isFirstTimeLogin = !existingUser;

      // Upsert user in database
      const user = await storage.upsertUser(userData);
      console.log("User upserted successfully:", user);

      // Don't start trial automatically - require payment method setup first
      if (isFirstTimeLogin) {
        console.log("New user detected, will require trial signup:", user.id);
      }

      // Add flag to indicate first-time login
      (user as any).isFirstTimeLogin = isFirstTimeLogin;

      return done(null, user);
    } catch (error) {
      console.error("Error during Google authentication:", error);
      return done(error as Error, undefined);
    }
  }));

  // Serialize user for session storage
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        // User not found, clear session
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("User deserialization error:", error);
      // Clear session on error
      done(null, false);
    }
  });

  // Auth routes
  app.get("/api/auth/google", (req, res, next) => {
    const redirectTo = typeof req.query.redirectTo === "string" ? req.query.redirectTo : undefined;
    if (redirectTo) {
      (req.session as any).postAuthRedirect = redirectTo;
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  app.get(["/auth/google/callback", "/api/auth/google/callback"],
    passport.authenticate("google", {
      failureRedirect: "/",
      failureFlash: false
    }),
    async (req: any, res) => {
      try {
        console.log("Google Auth callback success:", req.user);
        const user = req.user as any;

        // honor requested redirect
        let redirectTo = (req.session as any)?.postAuthRedirect;
        if ((req.session as any)) delete (req.session as any).postAuthRedirect;

        if (!redirectTo) {
          const dbUser = await storage.getUser(user.id);

          // Determine if subscription is required
          const now = new Date();
          const trialEndDate = dbUser?.trialEndDate ? new Date(dbUser.trialEndDate) : null;
          const isTrialExpired = trialEndDate ? now > trialEndDate : true;

          let needsSubscription = false;
          if (!dbUser?.subscriptionStatus || dbUser.subscriptionStatus === "none") {
            needsSubscription = true;
          } else if (dbUser.subscriptionStatus === "trial" && (!dbUser.stripeCustomerId || isTrialExpired)) {
            needsSubscription = true;
          } else if (dbUser.subscriptionStatus === "expired" || dbUser.subscriptionStatus === "cancelled") {
            needsSubscription = true;
          }

          redirectTo = needsSubscription ? "/trial-signup" : "/";
        }

        res.redirect(redirectTo);
      } catch (error) {
        console.error("Google Auth callback error:", error);
        res.status(500).json({ error: "Authentication failed" });
      }
    }
  );

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          console.error("Session destruction error:", sessionErr);
        }
        res.clearCookie("connect.sid");
        res.redirect("/");
      });
    });
  });

  // Legacy login endpoint for compatibility
  app.get("/api/login", (req, res) => {
    res.redirect("/api/auth/google");
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  res.status(401).json({ message: "Unauthorized" });
};
