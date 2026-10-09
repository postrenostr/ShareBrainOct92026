import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export interface TenWordsApiAuthOptions {
  getApiKey?: () => string | undefined;
  now?: () => number;
  maxRequests?: number;
}

// Dedicated integration key: this grants access only to the 10words router.
// Browser sessions continue to use the existing authentication middleware.
export function createTenWordsAuth(sessionAuth: RequestHandler, {
  getApiKey = () => process.env.TEN_WORDS_API_KEY,
  now = Date.now,
  maxRequests = 120,
}: TenWordsApiAuthOptions = {}): RequestHandler {
  let windowStart = 0;
  let count = 0;
  return (req, res, next) => {
    const authorization = req.headers.authorization;
    if (authorization === undefined) return sessionAuth(req, res, next);
    const match = authorization.match(/^Bearer ([^\s]{32,256})$/i);
    const configured = getApiKey();
    if (!match || !configured || configured.length < 32 || configured.length > 256) {
      res.set("WWW-Authenticate", "Bearer").status(401).json({ message: "Invalid 10words API key." });
      return;
    }
    const hash = (value: string) => createHash("sha256").update(value).digest();
    if (!timingSafeEqual(hash(match[1]), hash(configured))) {
      res.set("WWW-Authenticate", "Bearer").status(401).json({ message: "Invalid 10words API key." });
      return;
    }
    const time = now();
    if (time >= windowStart + 60000 || time < windowStart) { windowStart = time; count = 0; }
    if (count >= maxRequests) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((windowStart + 60000 - time) / 1000))))
        .status(429).json({ message: "10words API rate limit reached. Please retry shortly." });
      return;
    }
    count++;
    next();
  };
}
