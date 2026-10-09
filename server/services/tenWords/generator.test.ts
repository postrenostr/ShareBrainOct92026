import { describe, it, expect, vi } from "vitest";
import type OpenAI from "openai";
import { createTenWordsGenerator, validateNativeScript } from "./generator";
import { lessonText, tenWordsContentSchema, parseLessonCommand, tenWordsLanguages } from "@shared/tenWords";
import { tenWordsCurriculum } from "./curriculum";

const spanish = tenWordsLanguages[0];
const content = {
  words: ["Hola", "Agua", "Comida", "Casa", "Amigo", "Libro", "Bueno", "Sí", "No", "Gracias"],
  sentences: ["Hola, ¿cómo estás?", "Quiero agua.", "La comida está rica.", "Esta es mi casa.", "Él es mi amigo.",
    "Leo un libro.", "El pan es bueno.", "Sí, entiendo.", "No quiero ir.", "Gracias por tu ayuda."],
};
const completion = (value: unknown) => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
function setup() {
  const create = vi.fn();
  const speech = vi.fn(async (_request: unknown) => ({ arrayBuffer: async () => Buffer.from([1, 0]) }));
  const client = { chat: { completions: { create } }, audio: { speech: { create: speech } } } as unknown as OpenAI;
  return { generator: createTenWordsGenerator(() => client), create, speech };
}

describe("10words generation and speech", () => {
  it("guards native scripts throughout the expanded catalog, including regional variants", () => {
    for (const language of tenWordsLanguages) {
      if (!/[^\p{Script=Latin}\p{Mark}\s'’ʻ-]/u.test(language.nativeName)) continue;
      expect(() => validateNativeScript(language.code, [language.nativeName])).not.toThrow();
      expect(() => validateNativeScript(language.code, ["hello"])).toThrow("native script");
    }
    expect(() => validateNativeScript("ja", ["こんにちは"])).not.toThrow();
    expect(() => validateNativeScript("ar-EG", ["مرحبا hello"])).toThrow("native script");
  });

  it("generates and independently reviews target-only content", async () => {
    const { generator, create } = setup();
    create.mockResolvedValueOnce(completion(content)).mockResolvedValueOnce(completion({ valid: true }));
    expect(await generator.generate(spanish, 1)).toEqual(content);
    expect(create).toHaveBeenCalledTimes(2);
    const request = create.mock.calls[0][0];
    expect(request.messages[0].content).toContain("entirely in Spanish");
    expect(JSON.parse(request.messages[1].content).curriculum).toEqual(tenWordsCurriculum[0]);
    expect(lessonText(content)).toBe(content.words.join("\n") + "\n\n" + content.sentences.join("\n"));
  });
  it("supports English as the target language without forbidding English text", async () => {
    const { generator, create } = setup();
    create.mockResolvedValueOnce(completion(content)).mockResolvedValueOnce(completion({ valid: true }));
    await generator.generate(tenWordsLanguages.find(language => language.code === "en")!, 1);
    expect(create.mock.calls[0][0].messages[0].content).toContain("entirely in English");
    expect(create.mock.calls[0][0].messages[0].content).not.toContain("No English");
  });
  it("retries output rejected by language review", async () => {
    const { generator, create } = setup();
    create.mockResolvedValueOnce(completion(content)).mockResolvedValueOnce(completion({ valid: false }))
      .mockResolvedValueOnce(completion(content)).mockResolvedValueOnce(completion({ valid: true }));
    expect(await generator.generate(spanish, 1)).toEqual(content);
    expect(create).toHaveBeenCalledTimes(4);
  });
  it("fails instead of returning English or unvalidated output", async () => {
    const { generator, create } = setup();
    create.mockResolvedValue(completion({ words: ["hello"], sentences: ["Hello."] }));
    await expect(generator.generate(spanish, 1)).rejects.toThrow("valid target-language lesson");
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("rejects persistent language-review failures", async () => {
    const { generator, create } = setup();
    create.mockResolvedValueOnce(completion(content)).mockResolvedValueOnce(completion({ valid: false }))
      .mockResolvedValueOnce(completion(content)).mockResolvedValueOnce(completion({ valid: false }));
    await expect(generator.generate(spanish, 1)).rejects.toThrow("valid target-language lesson");
  });
  it("uses advanced vocabulary and earlier vocabulary for later lessons", async () => {
    const { generator, create } = setup();
    create.mockResolvedValueOnce(completion(content)).mockResolvedValueOnce(completion({ valid: true }));
    await generator.generate(spanish, 48);
    expect(create.mock.calls[0][0].messages[0].content).toContain("Advanced");
    expect(JSON.parse(create.mock.calls[0][0].messages[1].content).curriculum).toContain("Responsibility");
    expect(JSON.parse(create.mock.calls[0][0].messages[1].content).earlierVocabulary).toContain("Water");
  });
  it("narrates the whole lesson in one MP3 request without added pauses", async () => {
    const { generator, speech } = setup();
    await generator.speak(lessonText(content));
    expect(speech).toHaveBeenCalledTimes(1);
    expect(speech).toHaveBeenCalledWith({ model: "tts-1-hd", voice: "alloy", input: lessonText(content), response_format: "mp3" });
  });

});

describe("lesson contract", () => {
  it("has fifty ten-item lessons", () => {
    expect(tenWordsCurriculum).toHaveLength(50);
    expect(tenWordsCurriculum.every(words => words.length === 10)).toBe(true);
  });
  it.each(["1. Hola", "Hola (hello)", "Hola - hello", "**Hola**", "Hola\nhello", "١. Hola", "• Hola"])("rejects bilingual/numbered formatting %s", value => {
    expect(tenWordsContentSchema.safeParse({ ...content, words: [value, ...content.words.slice(1)] }).success).toBe(false);
  });
  it("rejects duplicate vocabulary and extra prose fields", () => {
    expect(tenWordsContentSchema.safeParse({ ...content, words: Array(10).fill("Hola") }).success).toBe(false);
    expect(tenWordsContentSchema.safeParse({ ...content, introduction: "Welcome" }).success).toBe(false);
  });
  it("keeps the entire text inside the speech API input limit", () => {
    const longest = { words: Array.from({ length: 10 }, (_, i) => String.fromCharCode(97 + i).repeat(100)),
      sentences: Array(10).fill("a".repeat(250)) };
    expect(lessonText(tenWordsContentSchema.parse(longest)).length).toBeLessThan(4096);
  });
  it("accepts native Japanese and rejects English/romanization", () => {
    expect(() => validateNativeScript("ja", ["水", "水を飲みます。"])).not.toThrow();
    expect(() => validateNativeScript("ja", ["mizu"])).toThrow();
    expect(() => validateNativeScript("ja", ["水 water"])).toThrow();
  });
  it.each(["Lesson 1", "lesson 25", " Lesson 50. "])("accepts command %s", command => {
    expect(parseLessonCommand(command)).not.toBeNull();
  });
  it.each(["Lesson 0", "Lesson 51", "Lesson 1.5", "Lesson 1 please", "Lesson 1; DROP TABLE", "hello"])("rejects command %s", command => {
    expect(parseLessonCommand(command)).toBeNull();
  });
});
