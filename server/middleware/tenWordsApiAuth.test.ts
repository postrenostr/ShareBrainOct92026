import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createTenWordsAuth } from "./tenWordsApiAuth";

const key = "a".repeat(64);
function setup(configured: string | undefined = key, authenticated = false, now = () => 100000) {
  const sessionAuth = vi.fn((_req, res, next) => {
    if (authenticated) next(); else res.status(401).json({ message: "Session required" });
  });
  const app = express();
  app.get("/10words", createTenWordsAuth(sessionAuth, { getApiKey: () => configured, maxRequests: 2, now }), (_req, res) => res.json({ ok: true }));
  return { app, sessionAuth };
}

describe("10words integration authentication", () => {
  it("accepts the dedicated Bearer key without a session", async () => {
    const { app, sessionAuth } = setup();
    await request(app).get("/10words").set("Authorization", `Bearer ${key}`).expect(200);
    expect(sessionAuth).not.toHaveBeenCalled();
  });
  it("keeps existing session access when no Authorization header is supplied", async () => {
    const { app, sessionAuth } = setup("", true);
    await request(app).get("/10words").expect(200);
    expect(sessionAuth).toHaveBeenCalledTimes(1);
  });
  it("rejects anonymous requests", async () => {
    await request(setup().app).get("/10words").expect(401);
  });
  it.each([`Bearer ${"b".repeat(64)}`, "Bearer short", `Basic ${key}`, `Bearer ${key} extra`, `Bearer ${"a".repeat(257)}`])("rejects malformed/wrong credentials even with a valid session", async header => {
    const { app, sessionAuth } = setup(key, true);
    const response = await request(app).get("/10words").set("Authorization", header).expect(401);
    expect(response.headers["www-authenticate"]).toBe("Bearer");
    expect(sessionAuth).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toContain(key);
  });
  it("disables key access when no key is configured, without disrupting sessions", async () => {
    const { app } = setup("", true);
    await request(app).get("/10words").set("Authorization", `Bearer ${key}`).expect(401);
    await request(app).get("/10words").expect(200);
  });
  it("does not accept a key from a query parameter", async () => {
    await request(setup().app).get(`/10words?api_key=${key}`).expect(401);
  });
  it("supports rotation without accepting the old key", async () => {
    let configured = key;
    const app = express();
    app.get("/10words", createTenWordsAuth((_req, res) => { res.sendStatus(401); }, { getApiKey: () => configured }), (_req, res) => res.sendStatus(200));
    await request(app).get("/10words").set("Authorization", `Bearer ${key}`).expect(200);
    configured = "b".repeat(64);
    await request(app).get("/10words").set("Authorization", `Bearer ${key}`).expect(401);
    await request(app).get("/10words").set("Authorization", `Bearer ${configured}`).expect(200);
  });
  it("limits authenticated API calls and resets the window", async () => {
    let time = 100000;
    const { app } = setup(key, false, () => time);
    await request(app).get("/10words").set("Authorization", `Bearer ${key}`).expect(200);
    await request(app).get("/10words").set("Authorization", `Bearer ${key}`).expect(200);
    const response = await request(app).get("/10words").set("Authorization", `Bearer ${key}`).expect(429);
    expect(response.headers["retry-after"]).toBe("60");
    time += 60000;
    await request(app).get("/10words").set("Authorization", `Bearer ${key}`).expect(200);
  });
});
