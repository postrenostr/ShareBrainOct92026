import "dotenv/config";
import { readFile } from "node:fs/promises";

async function main() {
  let connection: typeof import("../db").pool | undefined;
  try {
    if (process.env.REPLIT_DEPLOYMENT === "1") {
      console.error("Run migrations in development only; Publish applies the managed production schema.");
      process.exitCode = 1;
      return;
    }
    if (!process.env.DATABASE_URL) {
      console.error("Set DATABASE_URL securely before running the 10words migration.");
      process.exitCode = 1;
      return;
    }
    connection = (await import("../db")).pool;
    const sql = await readFile(new URL("../../migrations/0003_add_ten_words_lessons.sql", import.meta.url), "utf8");
    await connection.query(sql);
    await connection.query(await readFile(new URL("../../migrations/0004_add_ten_words_api_clients.sql", import.meta.url), "utf8"));
    await connection.query(await readFile(new URL("../../migrations/0005_add_ten_words_hd_upgrade.sql", import.meta.url), "utf8"));
    await connection.query("SELECT id, key_hash, scopes, rate_limit FROM ten_words_api_clients LIMIT 0");
    await connection.query("SELECT language, lesson_number, words, sentences, audio_base64, created_at FROM ten_words_lessons LIMIT 0");
    await connection.query("SELECT job_id,status,prepared_audio FROM ten_words_hd_upgrade_items LIMIT 0");
    console.log("10words lesson, API-client, and HD progress tables are ready. Existing data was preserved.");
  } catch {
    console.error("10words migration failed. Check DATABASE_URL, connectivity, and database permissions.");
    process.exitCode = 1;
  } finally {
    await connection?.end();
  }
}
void main();
