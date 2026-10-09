import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseStructuredLanguageLesson } from "./languageLesson";
import { LessonAudioControl } from "../components/lesson-audio-control";
import ChatInterface from "../components/chat-interface";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildLanguageTutorDefinitions } from "../../../server/services/languageTutorDefinitions";

export const catalanLesson = `Lesson 1
Vocabulary:
hola — hello
aigua — water
menjar — food
casa — house
amic — friend
llibre — book
bo — good
sí — yes
no — no
gràcies — thank you
Sentences:
Hola, com estàs? — Hello, how are you?
Vull aigua. — I want water.
El menjar és bo. — The food is good.
La casa és gran. — The house is big.
És el meu amic. — He is my friend.
Llegeixo un llibre. — I am reading a book.
Això és bo. — This is good.
Sí, ho entenc. — Yes, I understand.
No ho vull. — I do not want it.
Moltes gràcies. — Thank you very much.
Notes:
Practice these words aloud.`;

describe("native lesson playback", () => {
  it("extracts exactly ten Catalan words and ten sentences without English explanations", () => {
    const parsed = parseStructuredLanguageLesson(catalanLesson)!;
    const native = parsed.targetText.split("\n").filter(Boolean);
    expect(native).toHaveLength(20);
    expect(native.slice(0, 10)).toEqual(["hola", "aigua", "menjar", "casa", "amic", "llibre", "bo", "sí", "no", "gràcies"]);
    expect(native.slice(10)).toHaveLength(10);
    expect(parsed.targetText).not.toContain("I want water");
    expect(parsed.targetText).not.toContain("Practice these words aloud");
    expect(parsed.translationText).toContain("aigua — water");
  });
  it("handles non-Latin scripts without pronunciation or translation guesses", () => {
    const content = `Lesson 1\nVocabulary:\n${Array.from({ length: 10 }, () => "你好 — hello").join("\n")}\nSentences:\n${Array.from({ length: 10 }, () => "你好，朋友。 — Hello, friend.").join("\n")}`;
    const parsed = parseStructuredLanguageLesson(content)!;
    expect(parsed.targetText.split("\n").filter(Boolean)).toHaveLength(20);
    expect(parsed.targetText).not.toContain("hello");
    expect(parsed.targetText).toContain("你好，朋友。");
  });
  it("does not treat incomplete or malformed replies as a structured lesson", () => {
    expect(parseStructuredLanguageLesson(catalanLesson.replace("aigua — water\n", ""))).toBeNull();
    expect(parseStructuredLanguageLesson("Hello there")).toBeNull();
  });
  it("exposes the actual chat Play control for all restored tutor definitions", () => {
    for (const tutor of buildLanguageTutorDefinitions()) {
      const markup = renderToStaticMarkup(React.createElement(LessonAudioControl, {
        enabled: tutor.voiceEnabled, playing: false, disabled: false, onClick: () => {},
      }));
      expect(markup).toContain("Play Native Audio");
      expect(markup).toContain("<button");
    }
    expect(renderToStaticMarkup(React.createElement(LessonAudioControl, {
      enabled: false, playing: false, disabled: false, onClick: () => {},
    }))).toBe("");
  });
  it("renders a real Catalan lesson in the chat with native audio playback", () => {
    const tutor = buildLanguageTutorDefinitions().find(row => row.name === "Catalan Language Tutor")!;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(ChatInterface, {
        agentId: 1, conversationId: 1, voiceEnabled: tutor.voiceEnabled,
        onSendMessage: () => {},
        messages: [{ id: 1, conversationId: 1, role: "assistant", content: catalanLesson, metadata: null, createdAt: new Date(0) }],
      })));
    expect(markup).toContain("Play Native Audio");
    expect(markup).toContain("Vocabulary &amp; Translations");
    expect(markup).toContain("Practice (Target Language Only)");
    expect(markup).toContain("Vull aigua.");
    client.clear();
  });
});
