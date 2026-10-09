import { describe, it, expect, vi } from "vitest";
import { joinLessonAudio, pcmWave } from "./audio";
import { refreshSavedAudio } from "./refreshAudio";
import type { SavedLesson } from "./service";
const content = {
  words: ["Hola", "Agua", "Comida", "Casa", "Amigo", "Libro", "Bueno", "Sí", "No", "Gracias"],
  sentences: Array(10).fill("Hola, amigo."),
};
const paused = joinLessonAudio(Array(10).fill(Buffer.from([1, 0])), Buffer.from([2, 0]));
function setup() {
  const rows: SavedLesson[] = [
    { ...content, language: "es", lessonNumber: 1, audioBase64: Buffer.from("ID3old").toString("base64") },
    { ...content, language: "es", lessonNumber: 2, audioBase64: pcmWave(Buffer.from([1, 0])).toString("base64") },
    { ...content, language: "es", lessonNumber: 3, audioBase64: paused.toString("base64") },
    { ...content, language: "es", lessonNumber: 4, audioBase64: null },
  ];
  const store = { list: vi.fn(async () => structuredClone(rows)), replace: vi.fn(async (snapshot: SavedLesson, audio: string) => {
    rows.find(row => row.lessonNumber === snapshot.lessonNumber)!.audioBase64 = audio; return true;
  }) };
  const generator = { speak: vi.fn(async () => paused) };
  return { rows, store, generator };
}
describe("refresh existing 10words audio", () => {
  it("previews every saved lesson without writes or paid generation", async () => {
    const { store, generator } = setup();
    const result = await refreshSavedAudio(store, generator, false, () => {});
    expect(result).toMatchObject({ total: 4, pending: 3, current: 1, updated: 0 });
    expect(generator.speak).not.toHaveBeenCalled(); expect(store.replace).not.toHaveBeenCalled();
  });
  it("refreshes only missing or unpaused audio using identical text and is resumable", async () => {
    const { rows, store, generator } = setup();
    const before = structuredClone(rows);
    expect(await refreshSavedAudio(store, generator, true, () => {})).toMatchObject({ updated: 3, failed: 0 });
    expect(generator.speak).toHaveBeenCalledTimes(3);
    expect(generator.speak).toHaveBeenCalledWith(content);
    expect(rows.map(({ audioBase64, ...text }) => text)).toEqual(before.map(({ audioBase64, ...text }) => text));
    expect(await refreshSavedAudio(store, generator, true, () => {})).toMatchObject({ current: 4, updated: 0 });
    expect(generator.speak).toHaveBeenCalledTimes(3);
  });
  it("preserves failed/concurrently changed recordings and continues remaining lessons", async () => {
    const { rows, store, generator } = setup();
    const before = structuredClone(rows);
    generator.speak.mockRejectedValueOnce(new Error("secret provider error"));
    store.replace.mockResolvedValueOnce(false);
    const report = vi.fn();
    const result = await refreshSavedAudio(store, generator, true, report);
    expect(result).toMatchObject({ failed: 1, changed: 1, updated: 1 });
    expect(rows[0]).toEqual(before[0]); expect(rows[1]).toEqual(before[1]);
    expect(rows[3].audioBase64).toBe(paused.toString("base64"));
    expect(JSON.stringify(report.mock.calls)).not.toContain("secret");
  });
  it("does not save a provider recording without verified pauses", async () => {
    const { store, generator } = setup();
    generator.speak.mockResolvedValue(pcmWave(Buffer.from([1, 0])));
    expect(await refreshSavedAudio(store, generator, true, () => {})).toMatchObject({ failed: 3, updated: 0 });
    expect(store.replace).not.toHaveBeenCalled();
  });
});
