import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import express from "express";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { TenWordsApiKeys } from "./apiKeys";
import { createTenWordsKeysRouter } from "../../routes/tenWordsKeys";
import { createTenWordsRouter } from "../../routes/tenWords";
import type { TenWordsService } from "./service";

describe.skipIf(process.env.TEN_WORDS_DB_TESTS !== "1")("real PostgreSQL 10words keys", () => {
  const schema = `tw_key_test_${randomUUID().replaceAll("-", "")}`;
  const table = `"${schema}".ten_words_api_clients`;
  const owner = randomUUID();
  const otherOwner = randomUUID();
  let pool: Pool;
  let clients: TenWordsApiKeys;
  let lessonFingerprint: string;
  let schemaCreated = false;

  async function fingerprint() {
    const result = await pool.query(`SELECT md5(COALESCE(string_agg(md5(row_to_json(t)::text), ''
      ORDER BY language, lesson_number), '')) AS fingerprint FROM ten_words_lessons t`);
    return result.rows[0].fingerprint;
  }
  beforeAll(async () => {
    if (!process.env.DATABASE_URL || process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production") {
      throw new Error("Use securely configured development credentials only.");
    }
    neonConfig.webSocketConstructor = ws;
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
    lessonFingerprint = await fingerprint();
    await pool.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await pool.query(`CREATE TABLE "${schema}".users (id varchar PRIMARY KEY)`);
    await pool.query(`INSERT INTO "${schema}".users (id) VALUES ($1), ($2)`, [owner, otherOwner]);
    const migration = await readFile(new URL("../../../migrations/0004_add_ten_words_api_clients.sql", import.meta.url), "utf8");
    await pool.query(migration.replace(/\bten_words_api_clients\b/g, table)
      .replace("REFERENCES users(id)", `REFERENCES "${schema}".users(id)`));
    clients = new TenWordsApiKeys({
      query: (sql, values) => pool.query(sql.replaceAll("ten_words_api_clients", table), values),
    });
  });
  afterAll(async () => {
    try {
      if (pool && lessonFingerprint) expect(await fingerprint()).toBe(lessonFingerprint);
    } finally {
      try {
        if (schemaCreated) await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally { await pool?.end(); }
    }
  });
  it("stores hashes, isolates owners, and invalidates rotated and revoked credentials", async () => {
    const issued = await clients.create(owner, { name: "Lifecycle", scopes: ["lessons:read"], rateLimit: 10 });
    const stored = (await pool.query(`SELECT key_hash, key_prefix FROM ${table} WHERE id=$1`, [issued.client.id])).rows[0];
    expect(stored.key_hash === issued.key).toBe(false);
    expect(stored.key_hash.length).toBe(64);
    expect(JSON.stringify(await clients.list(owner)).includes(issued.key)).toBe(false);
    expect(await clients.list(otherOwner)).toEqual([]);
    expect(await clients.rotate(otherOwner, issued.client.id)).toBeNull();
    expect(await clients.revoke(otherOwner, issued.client.id)).toBeNull();
    expect(await clients.authorize(issued.key, "audio:read")).toBe("forbidden");
    expect(await clients.authorize(issued.key, "lessons:read")).toBe("ok");
    const rotated = await clients.rotate(owner, issued.client.id);
    expect(rotated !== null).toBe(true);
    expect(await clients.authorize(issued.key, "lessons:read")).toBe("invalid");
    expect(await clients.authorize(rotated!.key, "lessons:read")).toBe("ok");
    expect(Number((await clients.list(owner))[0].usageCount)).toBe(2);
    await clients.revoke(owner, issued.client.id);
    expect(await clients.authorize(rotated!.key, "lessons:read")).toBe("invalid");
    expect(await clients.rotate(owner, issued.client.id)).toBeNull();
  });
  it("enforces independent limits across concurrent workers and preserves limits on rotation", async () => {
    // Avoid a minute boundary changing the window in the middle of this check.
    const second = Number((await pool.query("SELECT extract(second FROM clock_timestamp()) AS second")).rows[0].second);
    if (second > 55) await new Promise(resolve => setTimeout(resolve, (61 - second) * 1000));
    const issued = await clients.create(owner, { name: "Concurrent", scopes: ["languages:read"], rateLimit: 5 });
    const worker = new TenWordsApiKeys({
      query: (sql, values) => pool.query(sql.replaceAll("ten_words_api_clients", table), values),
    });
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) =>
      (i % 2 ? clients : worker).authorize(issued.key, "languages:read")));
    expect(results.filter(result => result === "ok").length).toBe(5);
    expect(results.filter(result => result === "limited").length).toBe(7);
    const rotated = await clients.rotate(owner, issued.client.id);
    expect(await clients.authorize(rotated!.key, "languages:read")).toBe("limited");
    const another = await clients.create(otherOwner, { name: "Independent", scopes: ["languages:read"], rateLimit: 1 });
    expect(await clients.authorize(another.key, "languages:read")).toBe("ok");
  });
  it("exercises management, endpoint scopes, sessions and HTTPS proxy origin without providers", async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    const session: express.RequestHandler = (req, res, next) => {
      if (req.get("X-Test-Owner") !== owner) { res.sendStatus(401); return; }
      req.user = { id: owner } as any;
      next();
    };
    const content = { language: "es", lessonNumber: 1, words: Array(10).fill("Hola"), sentences: Array(10).fill("Hola amigo.") };
    const service = {
      getLesson: async () => content,
      getAudio: async () => Buffer.from("ID3fixture-audio"),
    } as unknown as TenWordsService;
    app.use("/api/10words/clients", createTenWordsKeysRouter(clients, session));
    app.use("/api/10words", createTenWordsRouter(service, session, { clients }));
    app.get("/api/paid", session, (_req, res) => res.sendStatus(200));
    const issued = await request(app).post("/api/10words/clients")
      .set("X-Test-Owner", owner).set("Host", "sharebrain.test")
      .set("X-Forwarded-Proto", "https").set("Origin", "https://sharebrain.test")
      .send({ name: "HTTPS", scopes: ["languages:read", "lessons:read", "audio:read"], rateLimit: 120 }).expect(201);
    expect(issued.headers["cache-control"]).toBe("no-store");
    const header = `Bearer ${issued.body.key}`;
    await request(app).get("/api/10words/languages").set("Authorization", header).expect(200);
    await request(app).post("/api/10words/es/lesson").set("Authorization", header).send({ command: "Lesson 1" }).expect(200);
    const audio = await request(app).post("/api/10words/es/lessons/1/audio").set("Authorization", header).expect(200);
    expect(audio.headers["content-type"]).toContain("audio/mpeg");
    await request(app).get("/api/10words/clients").set("Authorization", header).expect(403);
    await request(app).get("/api/paid").set("Authorization", header).expect(401);
    await request(app).post("/api/10words/es/lesson").set("X-Test-Owner", owner).send({ command: "Lesson 1" }).expect(200);
    await request(app).post("/api/10words/clients").set("X-Test-Owner", owner)
      .set("Host", "sharebrain.test").set("X-Forwarded-Proto", "https").set("Origin", "https://foreign.test").send({}).expect(403);
    const limited = await clients.create(owner, { name: "Catalog only", scopes: ["languages:read"], rateLimit: 10 });
    await request(app).post("/api/10words/es/lesson").set("Authorization", `Bearer ${limited.key}`).send({ command: "Lesson 1" }).expect(403);
  });
});
