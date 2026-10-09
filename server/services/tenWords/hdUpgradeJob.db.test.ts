import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { HD_UPGRADE_JOB, TenWordsHdUpgradeJob, HdUpgradeConflict, type HdUpgradePool } from "./hdUpgradeJob";

const words = ["Hola", "Agua", "Comida", "Casa", "Amigo", "Libro", "Bueno", "Sí", "No", "Gracias"];
const sentences = Array(10).fill("Hola, amigo.");
const hd = Buffer.from("ID3test-hd");

describe.skipIf(process.env.TEN_WORDS_DB_TESTS !== "1")("persistent HD upgrade in isolated PostgreSQL", () => {
  const schema = `tw_hd_test_${randomUUID().replaceAll("-", "")}`;
  let pool: Pool;
  let store: HdUpgradePool;
  let created = false;
  let originalFingerprint: string;
  const tables = ["ten_words_lessons", "ten_words_hd_upgrade_jobs", "ten_words_hd_upgrade_items"];
  function scoped(sql: string) {
    for (const table of tables) sql = sql.replaceAll(new RegExp(`\\b${table}\\b`, "g"), `"${schema}".${table}`);
    return sql;
  }
  async function fingerprint() {
    return (await pool.query(`SELECT md5(coalesce(string_agg(md5(row_to_json(t)::text),
      '' ORDER BY language,lesson_number),'')) AS hash FROM ten_words_lessons t`)).rows[0].hash;
  }
  function make(speak = vi.fn(async () => hd)) {
    return { job: new TenWordsHdUpgradeJob(store, { speak }, "development"), speak };
  }
  beforeAll(async () => {
    if (!process.env.DATABASE_URL || process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production") {
      throw new Error("Use development credentials and isolated fixtures only.");
    }
    neonConfig.webSocketConstructor = ws;
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
    originalFingerprint = await fingerprint();
    await pool.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    await pool.query(`CREATE TABLE "${schema}".ten_words_lessons (
      language varchar(10), lesson_number integer, words json NOT NULL, sentences json NOT NULL,
      audio_base64 text, PRIMARY KEY(language,lesson_number))`);
    await pool.query(scoped(await readFile(new URL("../../../migrations/0005_add_ten_words_hd_upgrade.sql", import.meta.url), "utf8")));
    store = {
      query: (sql, values) => pool.query(scoped(sql), values),
      connect: async () => {
        const client = await pool.connect();
        return { query: (sql, values) => client.query(scoped(sql), values),
          release: destroy => client.release(destroy) };
      },
    };
  });
  beforeEach(async () => {
    await store.query("TRUNCATE ten_words_hd_upgrade_items,ten_words_hd_upgrade_jobs,ten_words_lessons");
    for (const number of [1, 2, 3]) {
      await store.query(`INSERT INTO ten_words_lessons VALUES('es',$1,$2,$3,$4)`,
        [number, JSON.stringify(words), JSON.stringify(sentences), number === 3 ? null : Buffer.from("ID3old").toString("base64")]);
    }
  });
  afterAll(async () => {
    try { if (pool && originalFingerprint) expect(await fingerprint()).toBe(originalFingerprint); }
    finally {
      try { if (created) await pool.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await pool?.end(); }
    }
  });
  it("does nothing on construction/status and captures the cohort exactly once", async () => {
    const { job, speak } = make();
    expect((await job.status()).job).toBeNull();
    await job.start();
    expect((await job.status()).counts.pending).toBe(3);
    expect(speak).not.toHaveBeenCalled();
    await store.query(`INSERT INTO ten_words_lessons VALUES('fr',1,$1,$2,NULL)`,
      [JSON.stringify(words), JSON.stringify(sentences)]);
    await job.start();
    const before = (await store.query("SELECT words::text,sentences::text FROM ten_words_lessons ORDER BY language,lesson_number")).rows;
    for (let i = 0; i < 5; i++) await job.step();
    expect(speak).toHaveBeenCalledTimes(3);
    expect((await job.status()).counts).toMatchObject({ total: 3, complete: 3, pending: 0 });
    const after = (await store.query("SELECT words::text,sentences::text FROM ten_words_lessons ORDER BY language,lesson_number")).rows;
    expect(after).toEqual(before);
    const restarted = make();
    await restarted.job.start(); await restarted.job.retry(); await restarted.job.step();
    expect(restarted.speak).not.toHaveBeenCalled();
    expect((await restarted.job.status()).counts.complete).toBe(3);
    expect((await store.query("SELECT audio_base64 FROM ten_words_lessons WHERE language='fr'")).rows[0].audio_base64).toBeNull();
  });
  it("reports failed audio and only retries unfinished lessons", async () => {
    const { job, speak } = make();
    speak.mockRejectedValueOnce(new Error("private provider secret"));
    await job.start(); await job.step(); await job.step(); await job.step();
    const status = await job.status();
    expect(status.counts).toMatchObject({ complete: 2, failed: 1 });
    expect(JSON.stringify(status)).not.toContain("private provider secret");
    expect((await store.query("SELECT audio_base64 FROM ten_words_lessons WHERE lesson_number=1")).rows[0].audio_base64)
      .toBe(Buffer.from("ID3old").toString("base64"));
    await job.retry(); await job.step(); await job.retry(); await job.step();
    expect(speak).toHaveBeenCalledTimes(4);
    expect((await job.status()).counts.complete).toBe(3);
  });
  it("rejects invalid audio without replacing the recording", async () => {
    const { job } = make(vi.fn(async () => Buffer.alloc(0)));
    await job.start(); await job.step();
    expect((await job.status()).counts.failed).toBe(1);
    expect((await store.query("SELECT audio_base64 FROM ten_words_lessons WHERE lesson_number=1")).rows[0].audio_base64)
      .toBe(Buffer.from("ID3old").toString("base64"));
  });
  it("blocks simultaneous workers across service instances", async () => {
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    let finish!: (audio: Buffer) => void;
    const wait = new Promise<Buffer>(resolve => { finish = resolve; });
    const { job, speak } = make(vi.fn(async () => { entered(); return wait; }));
    await job.start();
    const active = job.step();
    await started;
    const other = make();
    await expect(other.job.step()).rejects.toBeInstanceOf(HdUpgradeConflict);
    await expect(other.job.retry()).rejects.toBeInstanceOf(HdUpgradeConflict);
    await expect(other.job.start()).rejects.toBeInstanceOf(HdUpgradeConflict);
    expect(other.speak).not.toHaveBeenCalled();
    finish(hd);
    await active;
    expect(speak).toHaveBeenCalledTimes(1);
    expect((await job.status()).counts.complete).toBe(1);
  });
  it("requires explicit retry for interrupted attempts and reuses prepared bytes", async () => {
    const { job, speak } = make();
    await job.start();
    await store.query(`UPDATE ten_words_hd_upgrade_items SET status='running',prepared_audio=$1 WHERE lesson_number=1`, [hd.toString("base64")]);
    await expect(job.step()).rejects.toThrow("interrupted");
    expect(speak).not.toHaveBeenCalled();
    await job.retry(); await job.step();
    expect(speak).not.toHaveBeenCalled();
    expect((await job.status()).counts.complete).toBe(1);
  });
  it("does not overwrite text or audio changed before or during generation", async () => {
    const { job, speak } = make(vi.fn(async () => {
      await store.query("UPDATE ten_words_lessons SET audio_base64='concurrent' WHERE lesson_number=2");
      return hd;
    }));
    await job.start();
    const changedWords = ["Nuevo", ...words.slice(1)];
    await store.query("UPDATE ten_words_lessons SET words=$1 WHERE lesson_number=1", [JSON.stringify(changedWords)]);
    await job.step(); await job.step();
    expect(speak).toHaveBeenCalledTimes(1);
    expect((await job.status()).counts.conflict).toBe(2);
    expect((await store.query("SELECT words FROM ten_words_lessons WHERE lesson_number=1")).rows[0].words).toEqual(changedWords);
    expect((await store.query("SELECT audio_base64 FROM ten_words_lessons WHERE lesson_number=2")).rows[0].audio_base64).toBe("concurrent");
  });
  it("commits recording and completion atomically and reuses audio after DB failure", async () => {
    const { job, speak } = make();
    await job.start();
    let fail = true;
    const broken: HdUpgradePool = {
      query: (sql, values) => store.query(sql, values),
      connect: async () => {
        const client = await store.connect();
        return {
          query: async (sql, values) => {
            if (fail && sql.includes("status='complete'")) { fail = false; throw new Error("DB interruption"); }
            return client.query(sql, values);
          },
          release: destroy => client.release(destroy),
        };
      },
    };
    const interrupted = new TenWordsHdUpgradeJob(broken, { speak }, "development");
    await expect(interrupted.step()).rejects.toThrow("DB interruption");
    expect((await store.query("SELECT audio_base64 FROM ten_words_lessons WHERE lesson_number=1")).rows[0].audio_base64)
      .toBe(Buffer.from("ID3old").toString("base64"));
    expect((await job.status()).counts.running).toBe(1);
    await job.retry(); await job.step();
    expect(speak).toHaveBeenCalledTimes(1);
    expect((await job.status()).counts.complete).toBe(1);
  });
  it("reports deleted lessons instead of recreating their text", async () => {
    const { job, speak } = make();
    await job.start();
    await store.query("DELETE FROM ten_words_lessons WHERE lesson_number=1");
    await job.step();
    expect(speak).not.toHaveBeenCalled();
    expect((await job.status()).counts.conflict).toBe(1);
    expect((await store.query("SELECT * FROM ten_words_hd_upgrade_items WHERE job_id=$1", [HD_UPGRADE_JOB])).rows).toHaveLength(3);
  });
});
