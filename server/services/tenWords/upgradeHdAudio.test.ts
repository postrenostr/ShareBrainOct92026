import { describe, it, expect, vi } from "vitest";
import { upgradeAllHdAudio } from "./upgradeHdAudio";
import type { SavedLesson } from "./service";
const words = ["Hola", "Agua", "Comida", "Casa", "Amigo", "Libro", "Bueno", "Sí", "No", "Gracias"];
const sentences = Array(10).fill("Hola, amigo.");
function setup() {
  const rows: SavedLesson[] = [1, 2, 3].map(lessonNumber => ({ language: "es", lessonNumber, words, sentences, audioBase64: lessonNumber === 3 ? null : "previous" }));
  const store = { list: vi.fn(async () => structuredClone(rows)), replace: vi.fn(async (snapshot: SavedLesson, audio: string) => {
    rows.find(row => row.lessonNumber === snapshot.lessonNumber)!.audioBase64 = audio; return true;
  }) };
  const generator = { speak: vi.fn(async () => Buffer.from("ID3hd")) };
  return { rows, store, generator };
}
describe("all saved lesson HD upgrade", () => {
  it("previews without writes or paid calls", async () => {
    const { store, generator } = setup();
    expect(await upgradeAllHdAudio(store, generator, false, () => {})).toEqual({ total: 3, updated: 0, changed: 0, failed: 0 });
    expect(generator.speak).not.toHaveBeenCalled(); expect(store.replace).not.toHaveBeenCalled();
  });
  it("updates every existing lesson including missing audio, preserving text", async () => {
    const { rows, store, generator } = setup();
    const original = structuredClone(rows);
    expect(await upgradeAllHdAudio(store, generator, true, () => {})).toMatchObject({ updated: 3, failed: 0 });
    expect(generator.speak).toHaveBeenCalledTimes(3);
    expect(generator.speak).toHaveBeenCalledWith(words.join("\n") + "\n\n" + sentences.join("\n"));
    expect(rows.map(({ audioBase64, ...text }) => text)).toEqual(original.map(({ audioBase64, ...text }) => text));
    expect(rows.every(row => row.audioBase64 === Buffer.from("ID3hd").toString("base64"))).toBe(true);
  });
  it("preserves failed/concurrently changed records and continues", async () => {
    const { rows, store, generator } = setup();
    generator.speak.mockRejectedValueOnce(new Error("secret"));
    store.replace.mockResolvedValueOnce(false);
    const report = vi.fn();
    expect(await upgradeAllHdAudio(store, generator, true, report)).toMatchObject({ failed: 1, changed: 1, updated: 1 });
    expect(rows[0].audioBase64).toBe("previous"); expect(rows[1].audioBase64).toBe("previous");
    expect(JSON.stringify(report.mock.calls)).not.toContain("secret");
  });
  it("rejects invalid provider output without saving it", async () => {
    const { store, generator } = setup(); generator.speak.mockResolvedValue(Buffer.alloc(0));
    expect(await upgradeAllHdAudio(store, generator, true, () => {})).toMatchObject({ failed: 3, updated: 0 });
    expect(store.replace).not.toHaveBeenCalled();
  });
});
