import { describe, expect, it } from "vitest";
import type { Agent } from "@shared/schema";
import topLanguages from "../data/topLanguages";
import { universalCurriculum } from "../data/universalCurriculum";
import {
  buildLanguageTutorDefinitions, LANGUAGE_TUTOR_OWNER,
  LANGUAGE_TUTOR_CATEGORY, planLanguageTutorCatalog,
} from "./languageTutorDefinitions";

const definitions = buildLanguageTutorDefinitions();
const rows = () => definitions.map((row, i) => ({ ...row, id: i + 1 }) as Agent);

describe("public language tutor catalog", () => {
  it("covers all 100 languages with unique language-specific teaching instructions", () => {
    expect(definitions).toHaveLength(100);
    expect(new Set(definitions.map(row => row.name)).size).toBe(100);
    for (const [i, row] of definitions.entries()) {
      expect(row.name).toBe(`${topLanguages[i]} Language Tutor`);
      expect(row.systemPrompt).toContain(`Teach ${topLanguages[i]}`);
      expect(row.systemPrompt).toContain("Lesson 1 (words 1-10)");
      expect(row.systemPrompt).toContain(`Lesson ${universalCurriculum.length}`);
      expect(row.systemPrompt).toContain("translate");
      expect(row.model).toBe("gpt-4o");
    }
  });
  it("makes every tutor a public, active, non-personal template without paid content generation", () => {
    for (const row of definitions) {
      expect(row).toMatchObject({
        userId: LANGUAGE_TUTOR_OWNER, category: LANGUAGE_TUTOR_CATEGORY,
        isTemplate: true, status: "active", isPrivate: false,
        isPubliclyVisible: true, isPersonal: false, isSystemAgent: true,
        isScriptEditable: false, voiceEnabled: false, imageEnabled: false,
        hasSharedMemory: false, hasFriendsMemory: false,
      });
    }
  });
  it("creates a missing catalog and does nothing on a complete rerun", () => {
    expect(planLanguageTutorCatalog([]).create).toHaveLength(100);
    expect(planLanguageTutorCatalog(rows())).toEqual({ create: [], repair: [], total: 100 });
  });
  it("fills only missing tutors in a partial catalog", () => {
    const plan = planLanguageTutorCatalog(rows().slice(0, 12));
    expect(plan.create).toHaveLength(88);
    expect(plan.repair).toEqual([]);
  });
  it("does not overwrite a same-name private user agent", () => {
    const privateAgent = { ...rows()[0], userId: "fixture-owner", isPrivate: true, isTemplate: false };
    const before = structuredClone(privateAgent);
    const plan = planLanguageTutorCatalog([privateAgent]);
    expect(plan.create).toHaveLength(100);
    expect(plan.repair).toEqual([]);
    expect(privateAgent).toEqual(before);
  });
  it("repairs canonical built-in visibility without replacing customized instructions", () => {
    const row = { ...rows()[0], status: "inactive", isPrivate: true, category: "Other", systemPrompt: "Retained teaching instructions" };
    const plan = planLanguageTutorCatalog([row, ...rows().slice(1)]);
    expect(plan.create).toEqual([]);
    expect(plan.repair[0]).toMatchObject({ id: row.id, values: { status: "active", isPrivate: false, category: LANGUAGE_TUTOR_CATEGORY } });
    expect(plan.repair[0].values).not.toHaveProperty("systemPrompt");
  });
  it("restores absent built-in teaching instructions", () => {
    const row = { ...rows()[0], systemPrompt: null };
    expect(planLanguageTutorCatalog([row, ...rows().slice(1)]).repair[0].values.systemPrompt)
      .toBe(definitions[0].systemPrompt);
  });
  it("fails explicitly on duplicate built-in names", () => {
    expect(() => planLanguageTutorCatalog([rows()[0], { ...rows()[0], id: 999 }]))
      .toThrow("Duplicate built-in language tutor");
  });
});
