import type { RequestHandler } from "express";
import type { TenWordsApiKeys, TenWordsScope } from "../services/tenWords/apiKeys";

export interface TenWordsApiAuthOptions { clients?: Pick<TenWordsApiKeys, "authorize"> }
export function createTenWordsAuth(sessionAuth: RequestHandler, { clients }: TenWordsApiAuthOptions = {}): RequestHandler {
  return async (req, res, next) => {
    if (req.headers.authorization === undefined) return sessionAuth(req, res, next);
    const match = req.headers.authorization.match(/^Bearer (tw_[a-f0-9]{64})$/i);
    if (!match || !clients) {
      res.set("WWW-Authenticate", "Bearer").status(401).json({ message: "Invalid 10words API key." });
      return;
    }
    const scope: TenWordsScope | undefined = req.method === "GET" && /^\/languages\/?$/.test(req.path) ? "languages:read"
      : req.method === "POST" && /^\/[^/]+\/lesson\/?$/.test(req.path) ? "lessons:read"
      : req.method === "POST" && /^\/[^/]+\/lessons\/\d+\/audio\/?$/.test(req.path) ? "audio:read" : undefined;
    if (!scope) { res.status(403).json({ message: "This endpoint is not available to API keys." }); return; }
    try {
      const result = await clients.authorize(match[1], scope);
      if (result === "invalid") res.set("WWW-Authenticate", "Bearer").status(401).json({ message: "Invalid 10words API key." });
      else if (result === "forbidden") res.status(403).json({ message: "This key does not have permission for this endpoint." });
      else if (result === "limited") res.set("Retry-After", "60").status(429).json({ message: "This client's request limit has been reached." });
      else next();
    } catch {
      res.status(503).json({ message: "API-key authentication is temporarily unavailable." });
    }
  };
}
