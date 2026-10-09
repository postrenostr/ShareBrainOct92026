import { lessonText, tenWordsContentSchema } from "@shared/tenWords";
import type { HdUpgradeStatus } from "@shared/tenWordsHdUpgrade";
import { isMp3Audio } from "./audio";
import type { LessonGenerator } from "./service";

interface Queryable {
  query(sql: string, values?: any[]): Promise<{ rows: any[] }>;
}
interface Connection extends Queryable { release(destroy?: boolean): void }
export interface HdUpgradePool extends Queryable { connect(): Promise<Connection> }

export const HD_UPGRADE_JOB = "tts-1-hd-alloy-v1";
const lock = "hashtext('tenwords-hd-upgrade-v1')";
const textHash = "md5(jsonb_build_array(words::jsonb,sentences::jsonb)::text)";

export class HdUpgradeConflict extends Error {}

/** Persistent, explicitly driven maintenance. No timers or startup work. */
export class TenWordsHdUpgradeJob {
  constructor(
    private pool: HdUpgradePool,
    private generator: Pick<LessonGenerator, "speak">,
    private environment: HdUpgradeStatus["environment"],
  ) {}

  async status(): Promise<HdUpgradeStatus> {
    const jobs = await this.pool.query(
      "SELECT id,created_at AS \"createdAt\" FROM ten_words_hd_upgrade_jobs WHERE id=$1", [HD_UPGRADE_JOB]);
    const saved = await this.pool.query("SELECT count(*)::integer AS total FROM ten_words_lessons");
    const result = await this.pool.query(`SELECT language,lesson_number AS "lessonNumber",
      status,attempts,message FROM ten_words_hd_upgrade_items
      WHERE job_id=$1 ORDER BY language,lesson_number`, [HD_UPGRADE_JOB]);
    const counts: HdUpgradeStatus["counts"] = { total: result.rows.length, pending: 0,
      running: 0, complete: 0, failed: 0, conflict: 0 };
    for (const item of result.rows) {
      if (!(item.status in counts) || item.status === "total") throw new Error("Invalid upgrade state");
      counts[item.status as keyof typeof counts]++;
    }
    return { job: jobs.rows[0] ?? null, items: result.rows, counts, environment: this.environment,
      existingLessons: saved.rows[0].total };
  }

  async start() {
    await this.exclusive(async client => {
      await this.transaction(client, async () => {
        const inserted = await client.query(`INSERT INTO ten_words_hd_upgrade_jobs(id) VALUES($1)
          ON CONFLICT DO NOTHING RETURNING id`, [HD_UPGRADE_JOB]);
        // Capture the cohort once; starting again must not enroll new lessons.
        if (inserted.rows.length) {
          await client.query(`INSERT INTO ten_words_hd_upgrade_items
            (job_id,language,lesson_number,text_hash,audio_hash)
            SELECT $1,language,lesson_number,${textHash},md5(audio_base64)
            FROM ten_words_lessons`, [HD_UPGRADE_JOB]);
        }
      });
    });
    return this.status();
  }

  async retry() {
    await this.exclusive(async client => {
      // Acquiring the session lock proves any persisted running attempt is interrupted.
      await client.query(`UPDATE ten_words_hd_upgrade_items SET status='pending',message=NULL,updated_at=now()
        WHERE job_id=$1 AND status IN ('failed','conflict','running')`, [HD_UPGRADE_JOB]);
    });
    return this.status();
  }

  async step() {
    await this.exclusive(async client => {
      const interrupted = await client.query(`SELECT 1 FROM ten_words_hd_upgrade_items
        WHERE job_id=$1 AND status='running' LIMIT 1`, [HD_UPGRADE_JOB]);
      if (interrupted.rows.length) {
        throw new HdUpgradeConflict("An earlier attempt was interrupted. Use Retry unsuccessful to resume explicitly.");
      }
      const pending = await client.query(`SELECT * FROM ten_words_hd_upgrade_items
        WHERE job_id=$1 AND status='pending' ORDER BY language,lesson_number LIMIT 1`, [HD_UPGRADE_JOB]);
      const item = pending.rows[0];
      if (!item) return;
      const key = [HD_UPGRADE_JOB, item.language, item.lesson_number];
      const found = await client.query(`SELECT words,sentences,audio_base64,
        ${textHash} AS text_hash,md5(audio_base64) AS audio_hash FROM ten_words_lessons
        WHERE language=$1 AND lesson_number=$2`, [item.language, item.lesson_number]);
      const saved = found.rows[0];
      if (!saved || saved.text_hash !== item.text_hash || saved.audio_hash !== item.audio_hash) {
        await this.record(client, key, "conflict", "Lesson text or audio changed since the upgrade started; left untouched.");
        return;
      }
      await client.query(`UPDATE ten_words_hd_upgrade_items
        SET status='running',attempts=attempts+1,message=NULL,updated_at=now()
        WHERE job_id=$1 AND language=$2 AND lesson_number=$3`, key);
      let audio: Buffer;
      try {
        // Validate for narration but never normalize or write the saved words/sentences.
        const content = tenWordsContentSchema.parse({ words: saved.words, sentences: saved.sentences });
        audio = item.prepared_audio
          ? Buffer.from(item.prepared_audio, "base64")
          : await this.generator.speak(lessonText(content));
        if (!isMp3Audio(audio)) throw new Error("Invalid audio");
      } catch {
        await this.record(client, key, "failed", "HD generation or validation failed; previous audio preserved. Retry explicitly.");
        return;
      }
      // Persist generated bytes before replacement so explicit retries can reuse them.
      await client.query(`UPDATE ten_words_hd_upgrade_items SET prepared_audio=$4,updated_at=now()
        WHERE job_id=$1 AND language=$2 AND lesson_number=$3`, [...key, audio.toString("base64")]);
      await this.transaction(client, async () => {
        const replacement = await client.query(`UPDATE ten_words_lessons SET audio_base64=$3
          WHERE language=$1 AND lesson_number=$2 AND ${textHash}=$4
          AND md5(audio_base64) IS NOT DISTINCT FROM $5 RETURNING language`,
          [item.language, item.lesson_number, audio.toString("base64"), item.text_hash, item.audio_hash]);
        if (!replacement.rows.length) {
          await this.record(client, key, "conflict", "Lesson changed during generation; original replacement was not applied.");
        } else {
          // Audio write and completion commit together; no charged rerun after a crash here.
          await client.query(`UPDATE ten_words_hd_upgrade_items SET status='complete',message=NULL,
            prepared_audio=NULL,updated_at=now() WHERE job_id=$1 AND language=$2 AND lesson_number=$3`, key);
        }
      });
    });
    return this.status();
  }

  private async record(client: Queryable, key: any[], status: "failed" | "conflict", message: string) {
    await client.query(`UPDATE ten_words_hd_upgrade_items SET status=$4,message=$5,updated_at=now()
      WHERE job_id=$1 AND language=$2 AND lesson_number=$3`, [...key, status, message]);
  }

  private async transaction(client: Queryable, action: () => Promise<void>) {
    await client.query("BEGIN");
    try { await action(); await client.query("COMMIT"); }
    catch (error) { await client.query("ROLLBACK"); throw error; }
  }

  private async exclusive(action: (client: Connection) => Promise<void>) {
    const client = await this.pool.connect();
    let locked = false;
    let destroy = false;
    try {
      locked = (await client.query(`SELECT pg_try_advisory_lock(${lock}) AS locked`)).rows[0].locked;
      if (!locked) throw new HdUpgradeConflict("Another HD upgrade operation is active. Refresh before continuing.");
      await action(client);
    } finally {
      if (locked) {
        try { await client.query(`SELECT pg_advisory_unlock(${lock})`); }
        catch { destroy = true; }
      }
      client.release(destroy);
    }
  }
}
