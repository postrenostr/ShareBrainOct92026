import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { pcmWave } from "../services/tenWords/audio";
import { createTenWordsRouter } from "./tenWords";
import { TenWordsError, type TenWordsService } from "../services/tenWords/service";

function setup(authenticated = true) {
  const service = {
    getLesson: vi.fn(async () => ({ language: "es", lessonNumber: 1, words: ["Hola"], sentences: ["Hola."] })),
    getAudio: vi.fn(async () => pcmWave(Buffer.from([1, 0]))),
  };
  const app = express();
  app.use(express.json());
  app.use("/api/10words", createTenWordsRouter(service as unknown as TenWordsService,
    (_req, res, next) => { if (authenticated) next(); else res.status(401).json({ message: "Unauthorized" }); }));
  return { app, service };
}

describe("10words API", () => {
  it("requires authentication for catalog, lessons and audio", async () => {
    const { app, service } = setup(false);
    await request(app).get("/api/10words/languages").expect(401);
    await request(app).post("/api/10words/es/lesson").send({ command: "Lesson 1" }).expect(401);
    await request(app).post("/api/10words/es/lessons/1/audio").expect(401);
    expect(service.getLesson).not.toHaveBeenCalled();
    expect(service.getAudio).not.toHaveBeenCalled();
  });
  it("lists the language agents and accepts Lesson 1", async () => {
    const { app, service } = setup();
    const catalog = await request(app).get("/api/10words/languages").expect(200);
    expect(catalog.body.lessonCount).toBe(50);
    expect(catalog.body.languages).toHaveLength(100);
    expect(catalog.body.languages.some((language: { code: string }) => language.code === "es")).toBe(true);
    await request(app).post("/api/10words/es/lesson").send({ command: "Lesson 1" }).expect(200);
    expect(service.getLesson).toHaveBeenCalledWith("es", 1);
  });
  it("rejects invalid requests before generation", async () => {
    const { app, service } = setup();
    await request(app).post("/api/10words/es/lesson").send({ command: "Lesson 51" }).expect(400);
    await request(app).post("/api/10words/es/lesson").send({ lessonNumber: 1 }).expect(400);
    await request(app).post("/api/10words/es/lessons/1.5/audio").expect(400);
    expect(service.getLesson).not.toHaveBeenCalled();
    expect(service.getAudio).not.toHaveBeenCalled();
  });
  it("serves stored audio as WAV", async () => {
    const { app, service } = setup();
    const response = await request(app).post("/api/10words/es/lessons/1/audio").expect(200).expect("Content-Type", /audio\/wav/);
    expect(response.body).toEqual(pcmWave(Buffer.from([1, 0])));
    expect(response.headers["cache-control"]).toBe("private, no-cache");
    expect(service.getAudio).toHaveBeenCalledWith("es", 1);
  });
  it("reports unsupported language errors without AI fallback text", async () => {
    const { app, service } = setup();
    service.getLesson.mockRejectedValueOnce(new TenWordsError("Unsupported language", 400));
    const response = await request(app).post("/api/10words/unknown/lesson").send({ command: "Lesson 1" }).expect(400);
    expect(response.body.message).toBe("Unsupported language");
  });
  it("reports generation and speech failures without leaking credentials", async () => {
    const { app, service } = setup();
    service.getLesson.mockRejectedValueOnce(new Error("secret API data"));
    const lesson = await request(app).post("/api/10words/es/lesson").send({ command: "Lesson 1" }).expect(503);
    expect(JSON.stringify(lesson.body)).not.toContain("secret");
    service.getAudio.mockRejectedValueOnce(new Error("secret API data"));
    const audio = await request(app).post("/api/10words/es/lessons/1/audio").expect(503);
    expect(audio.body.message).toContain("saved lesson is unchanged");
    expect(JSON.stringify(audio.body)).not.toContain("secret");
  });
});
