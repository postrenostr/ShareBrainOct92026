import { z } from "zod";

export const TEN_WORDS_LESSON_COUNT = 50;
export const tenWordsLanguages = [
  { code: "es", name: "Spanish", nativeName: "Español", direction: "ltr" },
  { code: "fr", name: "French", nativeName: "Français", direction: "ltr" },
  { code: "de", name: "German", nativeName: "Deutsch", direction: "ltr" },
  { code: "it", name: "Italian", nativeName: "Italiano", direction: "ltr" },
  { code: "pt", name: "Portuguese", nativeName: "Português", direction: "ltr" },
  { code: "zh", name: "Chinese", nativeName: "中文", direction: "ltr" },
  { code: "ja", name: "Japanese", nativeName: "日本語", direction: "ltr" },
  { code: "ko", name: "Korean", nativeName: "한국어", direction: "ltr" },
  { code: "ru", name: "Russian", nativeName: "Русский", direction: "ltr" },
  { code: "ar", name: "Arabic", nativeName: "العربية", direction: "rtl" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", direction: "ltr" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", direction: "ltr" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", direction: "ltr" },
  { code: "pl", name: "Polish", nativeName: "Polski", direction: "ltr" },
] as const;
export type TenWordsLanguage = typeof tenWordsLanguages[number];

const entry = z.string().trim().min(1).max(500).refine(value =>
  !new RegExp(String.raw`[\r\n\p{N}()[\]{}*_#•]`, "u").test(value) &&
  !/^(?:[-–—]|lesson\b|section\b|vocabulary\b|sentences\b)/i.test(value) &&
  !/\s[-–—]\s/.test(value), "Use plain, unnumbered target-language text");
export const tenWordsContentSchema = z.object({
  words: z.array(entry.refine(value => value.length <= 100)).length(10),
  sentences: z.array(entry.refine(value => value.length <= 250)).length(10),
}).strict().refine(lesson => new Set(lesson.words).size === 10, "Vocabulary words must be distinct");
export type TenWordsContent = z.infer<typeof tenWordsContentSchema>;
export interface TenWordsLesson extends TenWordsContent {
  language: string;
  lessonNumber: number;
}
export function lessonText(lesson: TenWordsContent): string {
  return [...lesson.words, "", ...lesson.sentences].join("\n");
}
export function lessonLevel(lessonNumber: number): string {
  return lessonNumber <= 10 ? "Beginner" : lessonNumber <= 25 ? "Everyday" : lessonNumber <= 40 ? "Intermediate" : "Advanced";
}
export function parseLessonCommand(command: string): number | null {
  const match = command.trim().match(/^lesson\s+(\d+)\s*[.!]?$/i);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number >= 1 && number <= TEN_WORDS_LESSON_COUNT ? number : null;
}
