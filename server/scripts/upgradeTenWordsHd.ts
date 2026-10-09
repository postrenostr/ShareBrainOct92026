import "dotenv/config";
import { createTenWordsGenerator } from "../services/tenWords/generator";
import { upgradeAllHdAudio, type HdAudioStore } from "../services/tenWords/upgradeHdAudio";

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--apply")) {
    console.error("Usage: npm run audio:10words:upgrade-hd -- [--apply]"); process.exitCode = 1; return;
  }
  const apply = args.includes("--apply");
  if (!process.env.DATABASE_URL || (apply && !process.env.OPENAI_API_KEY)) {
    console.error("Configure DATABASE_URL securely; --apply also requires OPENAI_API_KEY.");
    process.exitCode = 1; return;
  }
  let connection: typeof import("../db").pool | undefined;
  try {
    connection = (await import("../db")).pool;
    const pool = connection;
    const store: HdAudioStore = {
      async list() {
        const result = await pool.query(`SELECT language, lesson_number AS "lessonNumber", words, sentences,
          audio_base64 AS "audioBase64" FROM ten_words_lessons ORDER BY language, lesson_number`);
        return result.rows;
      },
      async replace(saved, audio) {
        const result = await pool.query(`UPDATE ten_words_lessons SET audio_base64=$1
          WHERE language=$2 AND lesson_number=$3 AND audio_base64 IS NOT DISTINCT FROM $4
          AND words::jsonb=$5::jsonb AND sentences::jsonb=$6::jsonb RETURNING language`,
          [audio, saved.language, saved.lessonNumber, saved.audioBase64, JSON.stringify(saved.words), JSON.stringify(saved.sentences)]);
        return result.rows.length === 1;
      },
    };
    console.log(apply ? "Replacing audio for all saved lessons with tts-1-hd / Alloy. TTS charges apply." : "Preview only: no voice generation or database writes.");
    const result = await upgradeAllHdAudio(store, createTenWordsGenerator(), apply);
    console.log(JSON.stringify(result));
    if (result.failed || result.changed) process.exitCode = 1;
  } catch {
    console.error("HD upgrade could not complete. Check database/provider access. Completed recordings are retained.");
    process.exitCode = 1;
  } finally { await connection?.end(); }
}
void main();
