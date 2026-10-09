import { describe, expect, it } from "vitest";
import { isPausedLessonAudio, joinLessonAudio, pcmWave, SAMPLE_RATE, WORD_PAUSE_MS, SECTION_PAUSE_MS } from "./audio";
import { tenWordsLanguages } from "@shared/tenWords";
import topLanguages from "../../data/topLanguages";

describe("10words pauses", () => {
  it("inserts 600ms silence between words and one second before sentences", () => {
    const words = Array.from({ length: 10 }, (_, i) => Buffer.from([i + 1, 0]));
    const sentences = Buffer.from([11, 0]);
    const audio = joinLessonAudio(words, sentences);
    const pause = SAMPLE_RATE * 2 * WORD_PAUSE_MS / 1000;
    const sectionPause = SAMPLE_RATE * 2 * SECTION_PAUSE_MS / 1000;
    expect(audio.length).toBe(44 + 22 + 9 * pause + sectionPause);
    let offset = 44;
    words.forEach((word, index) => {
      expect(audio.subarray(offset, offset + 2)).toEqual(word);
      offset += 2;
      const gap = index === 9 ? sectionPause : pause;
      expect(audio.subarray(offset, offset + gap)).toEqual(Buffer.alloc(gap));
      offset += gap;
    });
    expect(audio.subarray(offset)).toEqual(sentences);
    expect(isPausedLessonAudio(audio)).toBe(true);
    expect(audio.readUInt32LE(24)).toBe(24000);
    expect(audio.readUInt16LE(22)).toBe(1);
    expect(audio.readUInt16LE(34)).toBe(16);
  });
  it("rejects truncated, empty and incomplete recordings", () => {
    expect(isPausedLessonAudio(Buffer.from("old mp3"))).toBe(false);
    expect(isPausedLessonAudio(pcmWave(Buffer.from([1, 0])).subarray(0, 44))).toBe(false);
    expect(() => pcmWave(Buffer.from([1]))).toThrow();
    expect(() => joinLessonAudio([Buffer.from([1, 0])], Buffer.from([1, 0]))).toThrow();
  });
});

describe("10words language choices", () => {
  it("matches all 100 normal language agents with distinct saved identities", () => {
    expect(tenWordsLanguages).toHaveLength(100);
    expect(new Set(tenWordsLanguages.map(language => language.name))).toEqual(new Set(topLanguages));
    expect(new Set(tenWordsLanguages.map(language => language.code)).size).toBe(100);
  });
  it("preserves existing language codes, Spanish first, and RTL directions", () => {
    expect(tenWordsLanguages[0].code).toBe("es");
    expect(tenWordsLanguages.find(language => language.name === "Mandarin Chinese")?.code).toBe("zh");
    expect(tenWordsLanguages.find(language => language.name === "Standard Arabic")?.code).toBe("ar");
    expect(tenWordsLanguages.find(language => language.code === "he")?.direction).toBe("rtl");
    expect(tenWordsLanguages.find(language => language.name === "Catalan")?.code).toBe("ca");
  });
});
