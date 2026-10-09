import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { lessonText, type TenWordsLesson } from "@shared/tenWords";
import { createTenWordsRouter } from "./tenWords";
import { TenWordsService, type LessonStore, type SavedLesson } from "../services/tenWords/service";

const spanishLesson = {
  language: "es",
  lessonNumber: 1,
  words: ["Hola", "Agua", "Comida", "Casa", "Amigo", "Libro", "Bueno", "Sí", "No", "Gracias"],
  sentences: [
    "Hola, ¿cómo estás?",
    "Necesito agua, por favor.",
    "La comida está lista.",
    "Mi casa es pequeña.",
    "Mi amigo es simpático.",
    "Leo un libro interesante.",
    "El día es bueno.",
    "Sí, entiendo.",
    "No quiero eso.",
    "Gracias por tu ayuda.",
  ],
} satisfies TenWordsLesson;

function isolatedStore(): LessonStore {
  const records = new Map<string, SavedLesson>();
  return {
    async find(language, lessonNumber) {
      const row = records.get(`${language}:${lessonNumber}`);
      return row ? structuredClone(row) : undefined;
    },
    async insertOnce(lesson) {
      const key = `${lesson.language}:${lesson.lessonNumber}`;
      if (!records.has(key)) records.set(key, { ...structuredClone(lesson), audioBase64: null });
    },
    async saveAudioOnce(language, lessonNumber, audioBase64) {
      const row = records.get(`${language}:${lessonNumber}`);
      if (row && row.audioBase64 === null) row.audioBase64 = audioBase64;
    },
  };
}

function testApp(service: TenWordsService, authenticated = true) {
  const app = express();
  app.use(express.json());
  // This stand-in belongs only to the test app, never the running application.
  app.use("/api/10words", createTenWordsRouter(service, (_req, res, next) => {
    if (authenticated) next();
    else res.status(401).json({ message: "Unauthorized" });
  }));
  return app;
}

describe("10words router and service integration", () => {
  it("keeps Spanish text and native-only audio identical across requests and a fresh service", async () => {
    const store = isolatedStore();
    const audio = Buffer.from("isolated-audio-fixture");
    const generator = {
      generate: vi.fn(async () => ({
        words: structuredClone(spanishLesson.words),
        sentences: structuredClone(spanishLesson.sentences),
      })),
      speak: vi.fn(async () => audio),
    };
    const app = testApp(new TenWordsService(store, generator));
    const first = await request(app).post("/api/10words/es/lesson").send({ command: "Lesson 1" }).expect(200);
    expect(first.body).toEqual(spanishLesson);
    expect(first.body.words).toHaveLength(10);
    expect(new Set(first.body.words).size).toBe(10);
    expect(first.body.sentences).toHaveLength(10);
    expect(first.body).not.toHaveProperty("audioBase64");

    const narrated = await request(app).post("/api/10words/es/lessons/1/audio")
      .expect(200).expect("Content-Type", /audio\/mpeg/);
    expect(narrated.body).toEqual(audio);
    expect(generator.speak).toHaveBeenCalledExactlyOnceWith(lessonText(spanishLesson));
    expect((await request(app).post("/api/10words/es/lesson").send({ command: "Lesson 1" }).expect(200)).body)
      .toEqual(first.body);
    expect((await request(app).post("/api/10words/es/lessons/1/audio").expect(200)).body).toEqual(narrated.body);

    const forbiddenGenerator = {
      generate: vi.fn(async () => { throw new Error("A saved lesson must not regenerate"); }),
      speak: vi.fn(async () => { throw new Error("Saved narration must not regenerate"); }),
    };
    const restarted = testApp(new TenWordsService(store, forbiddenGenerator));
    expect((await request(restarted).post("/api/10words/es/lesson").send({ command: "Lesson 1" }).expect(200)).body)
      .toEqual(first.body);
    expect((await request(restarted).post("/api/10words/es/lessons/1/audio").expect(200)).body).toEqual(narrated.body);
    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(generator.speak).toHaveBeenCalledTimes(1);
    expect(forbiddenGenerator.generate).not.toHaveBeenCalled();
    expect(forbiddenGenerator.speak).not.toHaveBeenCalled();
  });

  it("rejects signed-out requests before storage or paid providers are contacted", async () => {
    const store = isolatedStore();
    const find = vi.spyOn(store, "find");
    const generator = {
      generate: vi.fn(async () => { throw new Error("Provider must remain offline"); }),
      speak: vi.fn(async () => { throw new Error("Provider must remain offline"); }),
    };
    const app = testApp(new TenWordsService(store, generator), false);
    await request(app).get("/api/10words/languages").expect(401);
    await request(app).post("/api/10words/es/lesson").send({ command: "Lesson 1" }).expect(401);
    await request(app).post("/api/10words/es/lessons/1/audio").expect(401);
    expect(find).not.toHaveBeenCalled();
    expect(generator.generate).not.toHaveBeenCalled();
    expect(generator.speak).not.toHaveBeenCalled();
  });
});
