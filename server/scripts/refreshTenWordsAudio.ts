import "dotenv/config";
import { createTenWordsGenerator } from "../services/tenWords/generator";
import { refreshSavedAudio, type AudioRefreshStore } from "../services/tenWords/refreshAudio";

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--apply")) {
    console.error("Usage: npm run audio:10words:refresh -- [--apply]"); process.exitCode = 1; return;
  }
  const apply = args.includes("--apply");
  if (!process.env.DATABASE_URL || (apply && !process.env.OPENAI_API_KEY)) {
    console.error("Configure DATABASE_URL securely; --apply also requires OPENAI_API_KEY. No audio was changed.");
    process.exitCode = 1; return;
  }
  let connection: typeof import("../db").pool | undefined;
  try {
    connection = (await import("../db")).pool;
    const pool = connection;
    const store: AudioRefreshStore = {
      async list() {
        const result = await pool.query(`SELECT language, lesson_number AS "lessonNumber", words, sentences,
          audio_base64 AS "audioBase64" FROM ten_words_lessons ORDER BY language, lesson_number`);
        return result.rows;
      },
      async replace(row, audioBase64) {
        const result = await pool.query(`UPDATE ten_words_lessons SET audio_base64=$1
          WHERE language=$2 AND lesson_number=$3 AND audio_base64 IS NOT DISTINCT FROM $4
          AND words::jsonb=$5::jsonb AND sentences::jsonb=$6::jsonb RETURNING language`,
          [audioBase64, row.language, row.lessonNumber, row.audioBase64, JSON.stringify(row.words), JSON.stringify(row.sentences)]);
        return result.rows.length === 1;
      },
    };
    console.log(apply ? "Refreshing existing lessons only; voice-generation charges apply." : "Preview only: no audio generation or database writes.");
    const summary = await refreshSavedAudio(store, createTenWordsGenerator(), apply);
    console.log(JSON.stringify(summary));
    if (summary.failed || summary.changed) process.exitCode = 1;
  } catch {
    console.error("Audio refresh could not complete. Check database/provider access. Rerun to check remaining lessons; completed recordings are retained.");
    process.exitCode = 1;
  } finally { await connection?.end(); }
}
void main();
