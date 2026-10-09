import type { RequestHandler } from "express";
import { getPostLoginRedirect } from "../../shared/authRedirect";

/** Subscription checks belong to paid features, not Google sign-in. */
export const postGoogleLogin: RequestHandler = (req, res) => {
  const session = req.session as (typeof req.session & { postAuthRedirect?: unknown }) | undefined;
  const destination = getPostLoginRedirect(session?.postAuthRedirect);
  if (session) delete session.postAuthRedirect;

  // Passport authenticates before this handler; also fail safely if used alone.
  res.redirect(req.isAuthenticated?.() === true ? destination : "/");
};
