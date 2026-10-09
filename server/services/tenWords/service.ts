import { tenWordsContentSchema, tenWordsLanguages, TEN_WORDS_LESSON_COUNT,
  type TenWordsContent, type TenWordsLanguage, type TenWordsLesson } from "@shared/tenWords";

import { isPausedLessonAudio, isLegacyMp3Audio } from "./audio";

export interface SavedLesson extends TenWordsLesson { audioBase64: string | null }
export interface LessonStore {
  find(language: string, lessonNumber: number): Promise<SavedLesson | undefined>;
  // Database uniqueness chooses the winner; this must never replace existing content.
  insertOnce(lesson: TenWordsLesson): Promise<void>;
  saveAudioIfUnchanged(language: string, lessonNumber: number, audioBase64: string, previousAudio: string | null): Promise<void>;
}
export interface LessonGenerator {
  generate(language: TenWordsLanguage, lessonNumber: number): Promise<TenWordsContent>;
  speak(lesson: TenWordsContent): Promise<Buffer>;
}
export class TenWordsError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export class TenWordsService {
  private pendingLessons = new Map<string, Promise<SavedLesson>>();
  private pendingAudio = new Map<string, Promise<Buffer>>();
  constructor(private store: LessonStore, private generator: LessonGenerator) {}

  private validate(language: string, lessonNumber: number): TenWordsLanguage {
    const target = tenWordsLanguages.find(item => item.code === language);
    if (!target || !Number.isInteger(lessonNumber) || lessonNumber < 1 || lessonNumber > TEN_WORDS_LESSON_COUNT) {
      throw new TenWordsError("Choose a supported language and a lesson from 1 to 50.", 400);
    }
    return target;
  }

  async getLesson(language: string, lessonNumber: number): Promise<TenWordsLesson> {
    const target = this.validate(language, lessonNumber);
    const key = `${language}:${lessonNumber}`;
    let pending = this.pendingLessons.get(key);
    if (!pending) {
      pending = this.loadLesson(target, lessonNumber);
      this.pendingLessons.set(key, pending);
    }
    try {
      const saved = await pending;
      // Do not send stored audio in the JSON response.
      return { language, lessonNumber, ...tenWordsContentSchema.parse({ words: saved.words, sentences: saved.sentences }) };
    } finally {
      if (this.pendingLessons.get(key) === pending) this.pendingLessons.delete(key);
    }
  }

  private async loadLesson(language: TenWordsLanguage, lessonNumber: number): Promise<SavedLesson> {
    const cached = await this.store.find(language.code, lessonNumber);
    if (cached) return cached;
    const content = tenWordsContentSchema.parse(await this.generator.generate(language, lessonNumber));
    await this.store.insertOnce({ language: language.code, lessonNumber, ...content });
    // Another process may have won. Always serve the persisted winner, never our draft.
    const saved = await this.store.find(language.code, lessonNumber);
    if (!saved) throw new Error("Lesson could not be saved");
    return saved;
  }

  async getAudio(language: string, lessonNumber: number): Promise<Buffer> {
    this.validate(language, lessonNumber);
    const key = `${language}:${lessonNumber}`;
    let pending = this.pendingAudio.get(key);
    if (!pending) {
      pending = this.loadAudio(language, lessonNumber);
      this.pendingAudio.set(key, pending);
    }
    try { return await pending; }
    finally { if (this.pendingAudio.get(key) === pending) this.pendingAudio.delete(key); }
  }

  private async loadAudio(language: string, lessonNumber: number): Promise<Buffer> {
    const lesson = await this.getLesson(language, lessonNumber);
    let saved = await this.store.find(language, lessonNumber);
    if (!saved) throw new Error("Lesson not found");
    if (!saved.audioBase64 || !isPausedLessonAudio(Buffer.from(saved.audioBase64, "base64"))) {
      const previousAudio = saved.audioBase64;
      try {
        const audio = await this.generator.speak({ words: lesson.words, sentences: lesson.sentences });
        if (!isPausedLessonAudio(audio)) throw new Error("Invalid paused lesson audio");
        // Upgrade old MP3 recordings without changing the saved lesson. If another
        // process has already upgraded the audio, retain its winner.
        await this.store.saveAudioIfUnchanged(language, lessonNumber, audio.toString("base64"), previousAudio);
        saved = await this.store.find(language, lessonNumber);
      } catch (error) {
        const legacy = previousAudio ? Buffer.from(previousAudio, "base64") : null;
        if (legacy && isLegacyMp3Audio(legacy)) return legacy;
        throw error;
      }
    }
    if (!saved?.audioBase64 || !isPausedLessonAudio(Buffer.from(saved.audioBase64, "base64"))) {
      throw new Error("Paused lesson audio could not be saved");
    }
    return Buffer.from(saved.audioBase64, "base64");
  }
}
