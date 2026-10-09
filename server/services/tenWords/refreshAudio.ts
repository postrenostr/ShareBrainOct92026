import { tenWordsContentSchema } from "@shared/tenWords";
import { isPausedLessonAudio } from "./audio";
import type { LessonGenerator, SavedLesson } from "./service";

export interface AudioRefreshStore {
  list(): Promise<SavedLesson[]>;
  // Only replace audio if both text and previous audio still match the snapshot.
  replace(snapshot: SavedLesson, audioBase64: string): Promise<boolean>;
}
export async function refreshSavedAudio(store: AudioRefreshStore, generator: Pick<LessonGenerator, "speak">,
  apply = false, report: (message: string) => void = console.log) {
  const rows = await store.list();
  const summary = { total: rows.length, current: 0, pending: 0, updated: 0, changed: 0, failed: 0 };
  // Sequential lessons keep provider load bounded. No lesson text is generated.
  for (const row of rows) {
    const label = `${row.language} Lesson ${row.lessonNumber}`;
    if (row.audioBase64 && isPausedLessonAudio(Buffer.from(row.audioBase64, "base64"))) {
      summary.current++; report(`${label}: pauses already verified`); continue;
    }
    summary.pending++;
    if (!apply) { report(`${label}: audio needs refresh`); continue; }
    try {
      const content = tenWordsContentSchema.parse({ words: row.words, sentences: row.sentences });
      const audio = await generator.speak(content);
      if (!isPausedLessonAudio(audio)) throw new Error("Unverified pauses");
      if (await store.replace(row, audio.toString("base64"))) {
        summary.updated++; report(`${label}: refreshed with verified pauses`);
      } else { summary.changed++; report(`${label}: changed during refresh; left untouched, rerun to check`); }
    } catch {
      summary.failed++; report(`${label}: refresh failed; existing text/audio preserved`);
    }
  }
  return summary;
}
