import { lessonText, tenWordsContentSchema } from "@shared/tenWords";
import { isMp3Audio } from "./audio";
import type { LessonGenerator, SavedLesson } from "./service";
export interface HdAudioStore {
  list(): Promise<SavedLesson[]>;
  replace(snapshot: SavedLesson, audio: string): Promise<boolean>;
}
// Only operates on saved lessons; never asks the generator to create text.
export async function upgradeAllHdAudio(store: HdAudioStore, generator: Pick<LessonGenerator, "speak">,
  apply: boolean, report: (message: string) => void = console.log) {
  const lessons = await store.list();
  const summary = { total: lessons.length, updated: 0, changed: 0, failed: 0 };
  for (const saved of lessons) {
    const label = `${saved.language} Lesson ${saved.lessonNumber}`;
    if (!apply) { report(`${label}: will replace audio with HD`); continue; }
    try {
      const content = tenWordsContentSchema.parse({ words: saved.words, sentences: saved.sentences });
      const audio = await generator.speak(lessonText(content));
      if (!isMp3Audio(audio)) throw new Error("Invalid MP3 audio");
      if (await store.replace(saved, audio.toString("base64"))) {
        summary.updated++; report(`${label}: HD audio saved`);
      } else { summary.changed++; report(`${label}: changed during generation; left untouched`); }
    } catch {
      summary.failed++; report(`${label}: failed; existing lesson/audio preserved`);
    }
  }
  return summary;
}
