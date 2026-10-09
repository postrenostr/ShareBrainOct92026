import { Router, type RequestHandler } from "express";
import { createTenWordsAuth, type TenWordsApiAuthOptions } from "../middleware/tenWordsApiAuth";
import { z } from "zod";
import { parseLessonCommand, tenWordsLanguages, TEN_WORDS_LESSON_COUNT } from "@shared/tenWords";
import { TenWordsError, type TenWordsService } from "../services/tenWords/service";

export function createTenWordsRouter(service: TenWordsService, authenticate: RequestHandler, apiAuthOptions?: TenWordsApiAuthOptions) {
  const router = Router();
  router.use(createTenWordsAuth(authenticate, apiAuthOptions));
  router.get("/languages", (_req, res) => res.json({ languages: tenWordsLanguages, lessonCount: TEN_WORDS_LESSON_COUNT }));
  // First access can create a lesson; use POST to avoid generation by prefetchers.
  router.post("/:language/lesson", async (req, res) => {
    const body = z.object({ command: z.string().max(80) }).strict().safeParse(req.body);
    const lessonNumber = body.success ? parseLessonCommand(body.data.command) : null;
    if (lessonNumber === null) return res.status(400).json({ message: "Enter Lesson 1 through Lesson 50." });
    try {
      res.json(await service.getLesson(req.params.language, lessonNumber));
    } catch (error) {
      console.error("10words lesson request failed:", error instanceof Error ? error.name : "Unknown error");
      res.status(error instanceof TenWordsError ? error.status : 503).json({
        message: error instanceof TenWordsError ? error.message : "The lesson could not be loaded. Please try again.",
      });
    }
  });
  router.post("/:language/lessons/:lessonNumber/audio", async (req, res) => {
    if (!/^\d+$/.test(req.params.lessonNumber)) return res.status(400).json({ message: "Invalid lesson number." });
    try {
      const audio = await service.getAudio(req.params.language, Number(req.params.lessonNumber));
      res.set({
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-cache",
      }).send(audio);
    } catch (error) {
      console.error("10words audio request failed:", error instanceof Error ? error.name : "Unknown error");
      res.status(error instanceof TenWordsError ? error.status : 503).json({
        message: error instanceof TenWordsError ? error.message : "Audio is unavailable. Your saved lesson is unchanged; please try again.",
      });
    }
  });
  return router;
}
