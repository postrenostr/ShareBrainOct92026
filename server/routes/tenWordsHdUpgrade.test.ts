import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { createTenWordsHdUpgradeRouter } from "./tenWordsHdUpgrade";
import { HdUpgradeConflict, type TenWordsHdUpgradeJob } from "../services/tenWords/hdUpgradeJob";

function setup(role: "admin" | "user" | "anonymous" = "admin") {
  const status = { job: null, items: [], counts: { total: 0 }, environment: "development" };
  const job = { status: vi.fn(async () => status), start: vi.fn(async () => status),
    step: vi.fn(async () => status), retry: vi.fn(async () => status) };
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/upgrade", createTenWordsHdUpgradeRouter(job as unknown as TenWordsHdUpgradeJob, (req, res, next) => {
    if (role === "anonymous") return void res.sendStatus(401);
    req.isAuthenticated = (() => true) as any;
    req.user = { email: role === "admin" ? "tom@colorfulranch.com" : "user@example.test" } as any;
    next();
  }));
  return { app, job };
}

describe("session-admin HD upgrade", () => {
  it("rejects anonymous, non-admin and API-key access for every operation", async () => {
    for (const role of ["anonymous", "user"] as const) {
      const { app, job } = setup(role);
      await request(app).get("/upgrade").expect(role === "anonymous" ? 401 : 403);
      for (const operation of ["start", "step", "retry"]) {
        await request(app).post(`/upgrade/${operation}`).send({}).expect(role === "anonymous" ? 401 : 403);
      }
      expect(job.status).not.toHaveBeenCalled();
      expect(job.step).not.toHaveBeenCalled();
    }
    const { app, job } = setup();
    await request(app).post("/upgrade/start").set("Authorization", "Bearer client-key")
      .send({ confirmation: "UPGRADE SAVED AUDIO" }).expect(403);
    expect(job.start).not.toHaveBeenCalled();
  });
  it("requires exact confirmation, JSON and same-origin mutations", async () => {
    const { app, job } = setup();
    await request(app).post("/upgrade/start").send({}).expect(400);
    await request(app).post("/upgrade/retry").send({ confirmation: "UPGRADE SAVED AUDIO" }).expect(400);
    await request(app).post("/upgrade/step").send({ unexpected: true }).expect(400);
    await request(app).post("/upgrade/start").type("form").send({}).expect(415);
    await request(app).post("/upgrade/step").set("Origin", "https://foreign.test").send({}).expect(403);
    expect(job.step).not.toHaveBeenCalled();
    expect(job.start).not.toHaveBeenCalled();
  });
  it("GET only previews and mutations call only the explicit operation", async () => {
    const { app, job } = setup();
    const response = await request(app).get("/upgrade").expect(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(job.start).not.toHaveBeenCalled();
    expect(job.step).not.toHaveBeenCalled();
    await request(app).post("/upgrade/start").send({ confirmation: "UPGRADE SAVED AUDIO" }).expect(200);
    expect(job.step).not.toHaveBeenCalled();
    await request(app).post("/upgrade/step").send({}).expect(200);
    await request(app).post("/upgrade/retry").send({ confirmation: "RETRY UNSUCCESSFUL AUDIO" }).expect(200);
    expect(job.start).toHaveBeenCalledTimes(1);
    expect(job.step).toHaveBeenCalledTimes(1);
    expect(job.retry).toHaveBeenCalledTimes(1);
  });
  it("reports active locks and sanitizes infrastructure errors", async () => {
    const { app, job } = setup();
    job.step.mockRejectedValueOnce(new HdUpgradeConflict("Another HD upgrade operation is active."));
    await request(app).post("/upgrade/step").send({}).expect(409);
    job.step.mockRejectedValueOnce(new Error("secret connection string"));
    const response = await request(app).post("/upgrade/step").send({}).expect(503);
    expect(JSON.stringify(response.body)).not.toContain("secret connection");
    job.status.mockRejectedValueOnce(new Error("private database details"));
    const status = await request(app).get("/upgrade").expect(503);
    expect(JSON.stringify(status.body)).not.toContain("private database");
  });
  it("accepts proxy HTTPS same-origin requests", async () => {
    const { app } = setup();
    await request(app).post("/upgrade/step").set("Host", "app.example")
      .set("X-Forwarded-Proto", "https").set("Origin", "https://app.example").send({}).expect(200);
  });
});
