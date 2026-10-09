import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/requireAdmin";
import { HdUpgradeConflict, type TenWordsHdUpgradeJob } from "../services/tenWords/hdUpgradeJob";

export function createTenWordsHdUpgradeRouter(job: TenWordsHdUpgradeJob, authenticate: RequestHandler) {
  const router = Router();
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (req.headers.authorization !== undefined) return res.status(403).json({ message: "Session administrator access required." });
    if (req.method !== "GET") {
      if (!req.is("application/json")) return res.status(415).json({ message: "Use application/json." });
      const origin = req.headers.origin;
      if (origin && origin !== `${req.protocol}://${req.get("host")}`) {
        return res.status(403).json({ message: "Invalid request origin." });
      }
    }
    return authenticate(req, res, next);
  });
  router.use(requireAdmin);
  router.get("/", async (_req, res) => {
    try { res.json(await job.status()); }
    catch { res.status(503).json({ message: "Upgrade status unavailable. Publish the progress-table schema and check database access." }); }
  });
  const confirmations = {
    start: z.object({ confirmation: z.literal("UPGRADE SAVED AUDIO") }).strict(),
    retry: z.object({ confirmation: z.literal("RETRY UNSUCCESSFUL AUDIO") }).strict(),
    step: z.object({}).strict(),
  };
  for (const operation of ["start", "step", "retry"] as const) {
    router.post(`/${operation}`, async (req, res) => {
      if (!confirmations[operation].safeParse(req.body).success) {
        return res.status(400).json({ message: "Explicit confirmation required; no upgrade was performed." });
      }
      try { res.json(await job[operation]()); }
      catch (error) {
        if (error instanceof HdUpgradeConflict) return res.status(409).json({ message: error.message });
        res.status(503).json({ message: "Upgrade interrupted. Refresh status before retrying; completed recordings remain saved." });
      }
    });
  }
  return router;
}
