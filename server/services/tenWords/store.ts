import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { tenWordsLessons } from "@shared/schema";
import type { LessonStore } from "./service";

export const tenWordsStore: LessonStore = {
  async find(language, lessonNumber) {
    const [lesson] = await db.select().from(tenWordsLessons).where(and(
      eq(tenWordsLessons.language, language), eq(tenWordsLessons.lessonNumber, lessonNumber)));
    return lesson;
  },
  async insertOnce(lesson) {
    await db.insert(tenWordsLessons).values(lesson).onConflictDoNothing({
      target: [tenWordsLessons.language, tenWordsLessons.lessonNumber],
    });
  },
  async saveAudioIfUnchanged(language, lessonNumber, audioBase64, previousAudio) {
    await db.update(tenWordsLessons).set({ audioBase64 }).where(and(
      eq(tenWordsLessons.language, language), eq(tenWordsLessons.lessonNumber, lessonNumber),
      previousAudio === null ? isNull(tenWordsLessons.audioBase64) : eq(tenWordsLessons.audioBase64, previousAudio)));
  },
};
