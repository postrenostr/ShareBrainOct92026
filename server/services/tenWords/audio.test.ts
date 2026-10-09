import { describe, expect, it } from "vitest";
import { isMp3Audio } from "./audio";
import { tenWordsLanguages } from "@shared/tenWords";
import topLanguages from "../../data/topLanguages";
it("recognizes MP3 and rejects WAV or empty audio", () => {
  expect(isMp3Audio(Buffer.from("ID3saved-mp3"))).toBe(true);
  expect(isMp3Audio(Buffer.from([0xff, 0xfb, 0x90]))).toBe(true);
  expect(isMp3Audio(Buffer.from("RIFFold-wave"))).toBe(false);
  expect(isMp3Audio(Buffer.alloc(0))).toBe(false);
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
