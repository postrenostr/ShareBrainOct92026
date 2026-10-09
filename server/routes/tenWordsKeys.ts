import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { tenWordsScopes, type TenWordsApiKeys } from "../services/tenWords/apiKeys";

export function createTenWordsKeysRouter(clients: TenWordsApiKeys, authenticate: RequestHandler) {
  const router = Router();
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    // Management is session-only. Keys never grant administration rights.
    if (req.headers.authorization !== undefined) return res.status(403).json({ message: "Sign in to manage client keys." });
    if (req.method !== "GET") {
      if (!req.is("application/json")) return res.status(415).json({ message: "Use application/json." });
      const origin = req.headers.origin;
      if (origin && origin !== `${req.protocol}://${req.get("host")}`) return res.status(403).json({ message: "Invalid request origin." });
    }
    return authenticate(req, res, next);
  });
  router.use((req, res, next) => {
    const user = req.user as any;
    const owner = user?.id || user?.claims?.sub;
    if (typeof owner !== "string" || !owner) return res.status(401).json({ message: "Unauthorized" });
    res.locals.owner = owner;
    next();
  });
  const options = z.object({ name: z.string().trim().min(1).max(80),
    scopes: z.array(z.enum(tenWordsScopes)).min(1).max(3).refine(values => new Set(values).size === values.length),
    rateLimit: z.number().int().min(1).max(120).default(120) }).strict();
  router.get("/", async (_req, res) => {
    try { res.json({ clients: await clients.list(res.locals.owner) }); }
    catch { res.status(503).json({ message: "Client keys could not be loaded." }); }
  });
  router.post("/", async (req, res) => {
    const body = options.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: "Provide a client name, permissions, and a limit from 1 to 120." });
    try { res.status(201).json(await clients.create(res.locals.owner, body.data)); }
    catch { res.status(503).json({ message: "Client key could not be created." }); }
  });
  for (const operation of ["rotate", "revoke"] as const) {
    router.post(`/:id/${operation}`, async (req, res) => {
      if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ message: "Invalid client ID." });
      try {
        const result = await clients[operation](res.locals.owner, req.params.id);
        if (!result) return res.status(404).json({ message: "Active client key not found." });
        res.json(result);
      } catch { res.status(503).json({ message: "Client key could not be updated." }); }
    });
  }
  return router;
}
