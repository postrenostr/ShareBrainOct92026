import { describe, it, expect, vi } from "vitest";
import { TenWordsService, type LessonStore, type SavedLesson, type LessonGenerator } from "./service";
import { type TenWordsContent } from "@shared/tenWords";

import { joinLessonAudio, pcmWave } from "./audio";
const pausedRecording = (pcm: Buffer) => joinLessonAudio(Array(10).fill(pcm), pcm);
const recording = pausedRecording(Buffer.from([1, 0, 2, 0]));

const content: TenWordsContent = {
  words: ["Hola", "Agua", "Comida", "Casa", "Amigo", "Libro", "Bueno", "Sí", "No", "Gracias"],
  sentences: ["Hola, ¿cómo estás?", "Quiero agua.", "La comida está rica.", "Esta es mi casa.", "Él es mi amigo.",
    "Leo un libro.", "El pan es bueno.", "Sí, entiendo.", "No quiero ir.", "Gracias por tu ayuda."],
};
function setup() {
  const rows = new Map<string, SavedLesson>();
  const key = (language: string, number: number) => `${language}:${number}`;
  const store: LessonStore = {
    find: vi.fn(async (language, number) => rows.get(key(language, number))),
    insertOnce: vi.fn(async lesson => {
      if (!rows.has(key(lesson.language, lesson.lessonNumber))) rows.set(key(lesson.language, lesson.lessonNumber), { ...lesson, audioBase64: null });
    }),
    saveAudioIfUnchanged: vi.fn(async (language, number, audioBase64, previousAudio) => {
      const row = rows.get(key(language, number));
      if (row && row.audioBase64 === previousAudio) row.audioBase64 = audioBase64;
    }),
  };
  const generator: LessonGenerator = {
    generate: vi.fn(async () => content), speak: vi.fn(async () => recording),
  };
  return { service: new TenWordsService(store, generator), store, generator, rows };
}

describe("fixed 10words lessons", () => {
  it("reuses saved content across visits and service restarts", async () => {
    const { service, generator, store } = setup();
    const first = await service.getLesson("es", 1);
    expect(first.words).toEqual(content.words);
    expect(first.sentences).toEqual(content.sentences);
    expect(await service.getLesson("es", 1)).toEqual(first);
    expect(await new TenWordsService(store, generator).getLesson("es", 1)).toEqual(first);
    expect(generator.generate).toHaveBeenCalledTimes(1);
  });
  it("coalesces simultaneous first requests", async () => {
    const { service, generator } = setup();
    const results = await Promise.all(Array.from({ length: 8 }, () => service.getLesson("es", 1)));
    expect(results.every(result => JSON.stringify(result) === JSON.stringify(results[0]))).toBe(true);
    expect(generator.generate).toHaveBeenCalledTimes(1);
  });
  it("returns the database winner when different processes generate competing lessons", async () => {
    const { store, generator } = setup();
    const other = { ...content, sentences: content.sentences.map(sentence => `${sentence} ¡Bien!`) };
    const secondGenerator = { ...generator, generate: vi.fn(async () => other) };
    const [a, b] = await Promise.all([
      new TenWordsService(store, generator).getLesson("es", 1),
      new TenWordsService(store, secondGenerator).getLesson("es", 1),
    ]);
    expect(a).toEqual(b);
  });
  it("isolates different languages and lesson numbers", async () => {
    const { service, rows } = setup();
    await service.getLesson("es", 1);
    await service.getLesson("es", 2);
    await service.getLesson("fr", 1);
    expect(rows.size).toBe(3);
  });
  it.each([["es", 0], ["es", 51], ["es", 1.5], ["unknown", 1]])("rejects invalid target %s/%s before generation", async (language, number) => {
    const { service, generator } = setup();
    await expect(service.getLesson(language, number)).rejects.toMatchObject({ status: 400 });
    expect(generator.generate).not.toHaveBeenCalled();
  });
  it("rejects malformed generated lessons without saving them", async () => {
    const { service, generator, store } = setup();
    vi.mocked(generator.generate).mockResolvedValue({ ...content, words: content.words.slice(0, 9) });
    await expect(service.getLesson("es", 1)).rejects.toThrow();
    expect(store.insertOnce).not.toHaveBeenCalled();
  });
  it("allows a failed generation to retry without storing fallback English", async () => {
    const { service, generator, rows } = setup();
    vi.mocked(generator.generate).mockRejectedValueOnce(new Error("API unavailable"));
    await expect(service.getLesson("es", 1)).rejects.toThrow("API unavailable");
    expect(rows.size).toBe(0);
    expect((await service.getLesson("es", 1)).words).toEqual(content.words);
  });
  it("narrates exactly the persisted words and sentences and reuses stored audio", async () => {
    const { service, generator, store } = setup();
    const first = await service.getAudio("es", 1);
    expect(first).toEqual(recording);
    expect(generator.speak).toHaveBeenCalledWith(content);
    expect(await new TenWordsService(store, generator).getAudio("es", 1)).toEqual(first);
    expect(generator.speak).toHaveBeenCalledTimes(1);
  });
  it("preserves the lesson when audio fails, and retries only narration", async () => {
    const { service, generator } = setup();
    const saved = await service.getLesson("es", 1);
    vi.mocked(generator.speak).mockRejectedValueOnce(new Error("TTS unavailable"));
    await expect(service.getAudio("es", 1)).rejects.toThrow("TTS unavailable");
    expect(await service.getLesson("es", 1)).toEqual(saved);
    await service.getAudio("es", 1);
    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(generator.speak).toHaveBeenCalledTimes(2);
  });
  it("upgrades cached MP3 audio once, without regenerating lesson text", async () => {
    const { service, generator, rows, store } = setup();
    await service.getLesson("es", 1);
    rows.get("es:1")!.audioBase64 = Buffer.from("old mp3").toString("base64");
    expect((await service.getAudio("es", 1)).equals(recording)).toBe(true);
    expect((await new TenWordsService(store, generator).getAudio("es", 1)).equals(recording)).toBe(true);
    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(generator.speak).toHaveBeenCalledTimes(1);
    expect(store.saveAudioIfUnchanged).toHaveBeenCalledWith("es", 1, recording.toString("base64"), Buffer.from("old mp3").toString("base64"));
  });
  it("upgrades an ordinary cached WAV rather than mistaking its format for pauses", async () => {
    const { service, generator, rows } = setup();
    const saved = await service.getLesson("es", 1);
    rows.get("es:1")!.audioBase64 = pcmWave(Buffer.from([1, 0, 2, 0])).toString("base64");
    expect((await service.getAudio("es", 1)).equals(recording)).toBe(true);
    expect(await service.getLesson("es", 1)).toEqual(saved);
    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(generator.speak).toHaveBeenCalledTimes(1);
  });
  it("rejects generated WAV audio that has no pauses without replacing cached bytes", async () => {
    const { service, generator, rows, store } = setup();
    await service.getLesson("es", 1);
    const previous = pcmWave(Buffer.from([1, 0])).toString("base64");
    rows.get("es:1")!.audioBase64 = previous;
    vi.mocked(generator.speak).mockResolvedValueOnce(pcmWave(Buffer.from([2, 0])));
    await expect(service.getAudio("es", 1)).rejects.toThrow("Invalid paused lesson audio");
    expect(rows.get("es:1")!.audioBase64).toBe(previous);
    expect(store.saveAudioIfUnchanged).not.toHaveBeenCalled();
  });
  it("preserves old audio and text when an upgrade fails, then retries", async () => {
    const { service, generator, rows } = setup();
    const saved = await service.getLesson("es", 1);
    const oldAudio = Buffer.from("ID3old mp3").toString("base64");
    rows.get("es:1")!.audioBase64 = oldAudio;
    vi.mocked(generator.speak).mockRejectedValueOnce(new Error("TTS unavailable"));
    await expect(service.getAudio("es", 1)).rejects.toThrow("TTS unavailable");
    expect(rows.get("es:1")!.audioBase64).toBe(oldAudio);
    expect(await service.getLesson("es", 1)).toEqual(saved);
    expect((await service.getAudio("es", 1)).equals(recording)).toBe(true);
    expect(generator.generate).toHaveBeenCalledTimes(1);
  });
  it("does not save incomplete audio", async () => {
    const { service, generator, store } = setup();
    vi.mocked(generator.speak).mockResolvedValue(Buffer.from("bad"));
    await expect(service.getAudio("es", 1)).rejects.toThrow("Invalid paused lesson audio");
    expect(store.saveAudioIfUnchanged).not.toHaveBeenCalled();
  });
  it("coalesces audio requests and serves the database audio winner", async () => {
    const { service, generator, store } = setup();
    vi.mocked(store.saveAudioIfUnchanged).mockImplementationOnce(async (language, number) => {
      const row = await store.find(language, number);
      if (row) row.audioBase64 = pausedRecording(Buffer.from([3, 0])).toString("base64");
    });
    const results = await Promise.all([service.getAudio("es", 1), service.getAudio("es", 1)]);
    expect(results.every(result => result.equals(pausedRecording(Buffer.from([3, 0]))))).toBe(true);
    expect(generator.speak).toHaveBeenCalledTimes(1);
  });
});
