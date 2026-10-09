import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./static";
import { initializeLanguageTutorCatalog } from "./services/languageTutorCatalog";
import { pool } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const catalog = await initializeLanguageTutorCatalog();
    log(`Language tutor catalog ready: ${catalog.total} tutors; ${catalog.created} created, ${catalog.repaired} repaired`);
  } catch {
    console.error("Language tutor initialization failed. Check database connectivity and catalog integrity before restarting.");
    process.exitCode = 1;
    await pool.end();
    return;
  }
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // Dynamic import to avoid bundling vite in production
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 5000;
  const host = process.env.HOST || "0.0.0.0";
  const canReusePort = process.platform !== "win32" && process.env.REUSE_PORT !== "false";

  let attemptedFallback = false;

  server.on("error", (err: any) => {
    const code = err?.code;
    if (!attemptedFallback && (code === "ENOTSUP" || code === "EINVAL")) {
      attemptedFallback = true;
      const fallbackHost = host === "0.0.0.0" ? "127.0.0.1" : host;
      log(`SO_REUSEPORT not supported; retrying without reusePort on ${fallbackHost}:${port}`);
      server.listen({ port, host: fallbackHost }, () => {
        log(`serving on port ${port}`);
      });
      return;
    }

    log(`server listen error: ${err?.stack || err?.message || err}`);
    process.exit(1);
  });

  const listenOptions: any = { port, host };
  if (canReusePort) listenOptions.reusePort = true;

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})();
