import "dotenv/config";
import OpenAI from "openai";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { lessonText, tenWordsContentSchema } from "@shared/tenWords";
import { isMp3Audio } from "../services/tenWords/audio";

// Read-only comparison sample: never creates lessons or replaces database audio.
async function main() {
  if (!process.env.DATABASE_URL || !process.env.OPENAI_API_KEY) {
    console.error("Configure DATABASE_URL and OPENAI_API_KEY securely before creating the HD sample.");
    process.exitCode = 1; return;
  }
  let connection: typeof import("../db").pool | undefined;
  try {
    connection = (await import("../db")).pool;
    const result = await connection.query("SELECT words, sentences FROM ten_words_lessons WHERE language=$1 AND lesson_number=$2", ["es", 1]);
    if (!result.rows.length) throw new Error("Saved lesson missing");
    const content = tenWordsContentSchema.parse(result.rows[0]);
    const directory = resolve("artifacts/10words-audio-samples");
    await mkdir(directory, { recursive: true });
    const output = resolve(directory, `spanish-lesson-1-tts-1-hd-${Date.now()}.mp3`);
    console.log("Creating one tts-1-hd / Alloy sample from saved Spanish Lesson 1. Normal TTS charges apply.");
    const response = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).audio.speech.create({
      model: "tts-1-hd", voice: "alloy", input: lessonText(content), response_format: "mp3",
    });
    const audio = Buffer.from(await response.arrayBuffer());
    if (!isMp3Audio(audio)) throw new Error("Invalid MP3 response");
    await writeFile(output, audio, { flag: "wx", mode: 0o600 });
    console.log(`HD sample saved: ${output}`);
    console.log("Saved lesson text and database audio were not changed. Play this file to compare with the current lesson.");
  } catch {
    console.error("HD sample could not be completed. Check that Spanish Lesson 1 exists and database/OpenAI access is available. No database content was changed.");
    process.exitCode = 1;
  } finally { await connection?.end(); }
}
void main();
