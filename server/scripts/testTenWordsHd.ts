import "dotenv/config";
import OpenAI from "openai";
import { lessonText, tenWordsContentSchema } from "@shared/tenWords";
import { isMp3Audio } from "../services/tenWords/audio";

// Replace only Spanish Lesson 1 narration; saved lesson text is unchanged.
async function main() {
  if (!process.env.DATABASE_URL || !process.env.OPENAI_API_KEY) {
    console.error("Configure DATABASE_URL and OPENAI_API_KEY securely before creating the HD sample.");
    process.exitCode = 1; return;
  }
  let connection: typeof import("../db").pool | undefined;
  try {
    connection = (await import("../db")).pool;
    const result = await connection.query("SELECT words, sentences, audio_base64 FROM ten_words_lessons WHERE language=$1 AND lesson_number=$2", ["es", 1]);
    if (!result.rows.length) throw new Error("Saved lesson missing");
    const saved = result.rows[0];
    const content = tenWordsContentSchema.parse({ words: saved.words, sentences: saved.sentences });
    console.log("Creating tts-1-hd / Alloy audio for Spanish Lesson 1 only. Normal TTS charges apply.");
    const response = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).audio.speech.create({
      model: "tts-1-hd", voice: "alloy", input: lessonText(content), response_format: "mp3",
    });
    const audio = Buffer.from(await response.arrayBuffer());
    if (!isMp3Audio(audio)) throw new Error("Invalid MP3 response");
    const updated = await connection.query(`UPDATE ten_words_lessons SET audio_base64=$1
      WHERE language='es' AND lesson_number=1 AND audio_base64 IS NOT DISTINCT FROM $2
      AND words::jsonb=$3::jsonb AND sentences::jsonb=$4::jsonb RETURNING language`,
      [audio.toString("base64"), saved.audio_base64, JSON.stringify(saved.words), JSON.stringify(saved.sentences)]);
    if (updated.rows.length !== 1) throw new Error("Lesson changed during generation");
    console.log("Spanish Lesson 1 now uses tts-1-hd / Alloy. Refresh the 10words page and press Play.");
    console.log("Lesson text and all other lessons were left unchanged.");
  } catch {
    console.error("HD update could not be completed. Check that Spanish Lesson 1 exists and database/OpenAI access is available, or retry if the lesson changed during generation.");
    process.exitCode = 1;
  } finally { await connection?.end(); }
}
void main();
