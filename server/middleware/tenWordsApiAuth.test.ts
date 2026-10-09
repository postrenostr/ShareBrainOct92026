import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { createTenWordsAuth } from "./tenWordsApiAuth";
const key = "tw_" + "a".repeat(64);
function setup(result: "ok" | "invalid" | "forbidden" | "limited" = "ok", signedIn = false) {
  const authorize = vi.fn(async () => result);
  const app = express();
  app.use(createTenWordsAuth((_req, res, next) => signedIn ? next() : void res.sendStatus(401), { clients: { authorize } }));
  app.use((_req, res) => res.json({ ok: true }));
  return { app, authorize };
}
describe("10words client authentication", () => {
  it("allows sessions without a key", async () => { await request(setup("ok", true).app).get("/languages").expect(200); });
  it("requires credentials", async () => { await request(setup().app).get("/languages").expect(401); });
  it("rejects malformed headers even with a session", async () => {
    const { app, authorize } = setup("ok", true);
    for (const header of ["Basic abc", "Bearer short", "Bearer " + "a".repeat(64), `Bearer ${key} extra`])
      await request(app).get("/languages").set("Authorization", header).expect(401);
    expect(authorize).not.toHaveBeenCalled();
  });
  it("does not accept query credentials", async () => { await request(setup().app).get(`/languages?api_key=${key}`).expect(401); });
  it("maps endpoint permissions", async () => {
    const { app, authorize } = setup();
    for (const [path, scope] of [["/languages", "languages:read"], ["/es/lesson", "lessons:read"], ["/fr/lessons/10/audio", "audio:read"]]) {
      const call = path === "/languages" ? request(app).get(path) : request(app).post(path);
      await call.set("Authorization", `Bearer ${key}`).expect(200);
      expect(authorize).toHaveBeenLastCalledWith(key, scope);
    }
    await request(app).post("/clients").set("Authorization", `Bearer ${key}`).expect(403);
  });
  it("returns invalid, forbidden and limited status codes", async () => {
    for (const [result, status] of [["invalid",401], ["forbidden",403], ["limited",429]] as const) {
      const response = await request(setup(result).app).get("/languages").set("Authorization", `Bearer ${key}`).expect(status);
      expect(JSON.stringify(response.body)).not.toContain(key);
      if (status === 429) expect(response.headers["retry-after"]).toBe("60");
    }
  });
  it("fails closed during database errors", async () => {
    const { app, authorize } = setup(); authorize.mockRejectedValueOnce(new Error("secret"));
    const response = await request(app).get("/languages").set("Authorization", `Bearer ${key}`).expect(503);
    expect(JSON.stringify(response.body)).not.toContain("secret");
  });
});
