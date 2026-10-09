import type { Agent } from "@shared/schema";
import topLanguages from "../data/topLanguages";
import { universalCurriculum } from "../data/universalCurriculum";

export const LANGUAGE_TUTOR_OWNER = "system:language-tutors";
export const LANGUAGE_TUTOR_CATEGORY = "Language Teachers";
const LEGACY_LESSON_INSTRUCTIONS = "For each requested lesson, provide the ten target-language translations, helpful pronunciation or transliteration, and short example sentences with explanations. Keep lessons readable and offer a short practice exercise.";
const LESSON_INSTRUCTIONS = `For each requested lesson, present exactly 10 words and exactly 10 sentences in the target language. Use one sentence for each vocabulary word.
Use this exact plain-text format, without numbering, bullets, Markdown tables, or parenthetical pronunciation inside the entries:
Lesson N
Vocabulary:
<target-language word> — <English meaning>
(exactly 10 vocabulary lines, following the requested curriculum lesson)
Sentences:
<target-language sentence> — <English translation>
(exactly 10 sentence lines, one for each vocabulary word)
Use the literal headings "Vocabulary:" and "Sentences:" even when the learner prefers another explanation language; the app uses these headings to separate translations from native-language audio. Do not print the placeholder lines or the parenthetical instructions above.
Keep any pronunciation guidance, grammar explanation, or practice question after the 10 sentence lines, under a separate "Notes:" heading. The Play Audio control reads only the 10 target-language words and 10 target-language sentences, not their English translations.
Never claim audio has already been generated or played. Audio is generated on demand when the learner presses Play.`;

export const languageTutorVisibility = {
  category: LANGUAGE_TUTOR_CATEGORY,
  status: "active",
  isTemplate: true,
  isPubliclyVisible: true,
  isPrivate: false,
  isPersonal: false,
  isSystemAgent: true,
  isScriptEditable: false,
} as const;

export function buildLanguageTutorDefinitions() {
  if (new Set(topLanguages).size !== topLanguages.length ||
      !universalCurriculum.length || universalCurriculum.some(words => words.length !== 10)) {
    throw new Error("Invalid language catalog or lesson curriculum");
  }
  const curriculum = universalCurriculum
    .map((words, i) => `Lesson ${i + 1} (words ${i * 10 + 1}-${(i + 1) * 10}): ${words.join(", ")}`)
    .join("\n");
  return topLanguages.map(language => ({
    ...languageTutorVisibility,
    userId: LANGUAGE_TUTOR_OWNER,
    name: `${language} Language Tutor`,
    description: `Learn ${language} with guided vocabulary, pronunciation, conversation, and ${universalCurriculum.length} structured lessons. Beginners welcome.`,
    // This API identifier uses the application's existing OpenAI chat routing.
    model: "gpt-4o",
    temperature: 0.7,
    maxTokens: 2048,
    voiceEnabled: true,
    voiceModel: "tts-1",
    voiceType: "alloy",
    imageEnabled: false,
    hasSharedMemory: false,
    hasFriendsMemory: false,
    sampleUser: `Teach me ${language}, starting with lesson 1.`,
    sampleAgent: `Let's begin learning ${language}. We'll practice ten useful words, simple sentences, and a short exercise together.`,
    systemPrompt: `You are a patient, encouraging ${language} language tutor.
Teach ${language}, adapting explanations to the learner's preferred language and ability. Use English explanations initially unless they ask otherwise.
For a beginner, start with Lesson 1. Recognize requests such as "lesson 3", "next lesson", "review lesson 2", and "start over".
Follow the shared curriculum below in order. Each lesson contains ten English source concepts to translate into ${language}; do not treat the source words as already translated.
${LESSON_INSTRUCTIONS}
Explain relevant grammar and writing-system conventions gently. Respect regional varieties. If unsure about a translation, dialect, or pronunciation, say so instead of inventing it.
Respond to questions and conversational practice as well as structured lessons. Correct errors kindly, and never claim an exercise is completed before the learner responds.
Do not claim access to cached lessons, recordings, images, or tools that have not been provided. Do not claim a particular underlying AI provider or model.

SHARED CURRICULUM (${universalCurriculum.length} lessons, ${universalCurriculum.flat().length} source concepts):
${curriculum}`,
  }));
}

type CatalogRow = Pick<Agent, "id" | "userId" | "name" | "systemPrompt" | "voiceEnabled" |
  keyof typeof languageTutorVisibility>;

export function planLanguageTutorCatalog(existing: CatalogRow[]) {
  const definitions = buildLanguageTutorDefinitions();
  const owned = existing.filter(row => row.userId === LANGUAGE_TUTOR_OWNER);
  const byName = new Map<string, CatalogRow>();
  for (const row of owned) {
    if (byName.has(row.name)) throw new Error(`Duplicate built-in language tutor: ${row.name}`);
    byName.set(row.name, row);
  }
  const create: typeof definitions = [];
  const repair: { id: number; values: Partial<Agent> }[] = [];
  for (const definition of definitions) {
    const row = byName.get(definition.name);
    if (!row) {
      create.push(definition);
      continue;
    }
    const needsVisibilityRepair = Object.entries(languageTutorVisibility)
      .some(([key, value]) => row[key as keyof CatalogRow] !== value);
    const needsInstructions = !row.systemPrompt?.trim();
    // Upgrade only our exact earlier generated prompt, not arbitrary user content.
    const legacyPrompt = definition.systemPrompt.replace(LESSON_INSTRUCTIONS, LEGACY_LESSON_INSTRUCTIONS);
    const needsLessonUpgrade = row.systemPrompt === legacyPrompt;
    const needsVoice = row.voiceEnabled !== true;
    if (needsVisibilityRepair || needsInstructions || needsLessonUpgrade || needsVoice) {
      repair.push({
        id: row.id,
        values: {
          ...languageTutorVisibility,
          ...(needsVoice ? { voiceEnabled: true } : {}),
          ...(needsInstructions || needsLessonUpgrade ? { systemPrompt: definition.systemPrompt } : {}),
        },
      });
    }
  }
  return { create, repair, total: definitions.length };
}
