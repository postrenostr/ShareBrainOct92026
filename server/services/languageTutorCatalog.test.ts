import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { Agent } from "@shared/schema";
import {
  buildLanguageTutorDefinitions, LANGUAGE_TUTOR_OWNER,
} from "./languageTutorDefinitions";

const database = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../db", () => ({ db: database }));
import { initializeLanguageTutorCatalog } from "./languageTutorCatalog";

beforeEach(() => vi.clearAllMocks());

function fixture(initial: Agent[] = [], failInsert = false) {
  let rows = structuredClone(initial);
  let tail = Promise.resolve();
  const events: string[] = [];
  const dialect = new PgDialect();
  const definitions = buildLanguageTutorDefinitions();
  database.transaction.mockImplementation(work => {
    const result = tail.then(async () => {
      const staged = structuredClone(rows);
      let locked = false;
      const assertLocked = () => expect(locked).toBe(true);
      const tx = {
        execute: async (query: SQL) => {
          expect(dialect.sqlToQuery(query).sql).toContain("pg_advisory_xact_lock");
          locked = true;
          events.push("lock");
        },
        select: () => ({
          from: () => ({
            where: async (query: SQL) => {
              assertLocked();
              const params = dialect.sqlToQuery(query).params;
              expect(params).toEqual([LANGUAGE_TUTOR_OWNER, ...definitions.map(row => row.name)]);
              events.push("read");
              return staged.filter(row => row.userId === LANGUAGE_TUTOR_OWNER &&
                definitions.some(definition => definition.name === row.name));
            },
          }),
        }),
        insert: () => ({
          values: async (values: Agent[]) => {
            assertLocked();
            if (failInsert) throw new Error("Fixture insert failure");
            events.push("insert");
            let nextId = Math.max(0, ...staged.map(row => row.id)) + 1;
            staged.push(...values.map(row => ({ ...row, id: nextId++ })));
          },
        }),
        update: () => ({
          set: (values: Partial<Agent>) => ({
            where: async (query: SQL) => {
              assertLocked();
              const [id, owner] = dialect.sqlToQuery(query).params;
              expect(owner).toBe(LANGUAGE_TUTOR_OWNER);
              const row = staged.find(row => row.id === id && row.userId === owner);
              if (row) Object.assign(row, values);
              events.push("repair");
            },
          }),
        }),
      };
      const outcome = await work(tx);
      rows = staged;
      return outcome;
    });
    tail = result.then(() => undefined, () => undefined);
    return result;
  });
  return { rows: () => rows, events };
}

describe("transactional language catalog initialization", () => {
  it("locks before reading and inserts all missing tutors in one transaction", async () => {
    const store = fixture();
    expect(await initializeLanguageTutorCatalog()).toEqual({ total: 100, created: 100, repaired: 0 });
    expect(store.events).toEqual(["lock", "read", "insert"]);
    expect(store.rows()).toHaveLength(100);
    expect(database.transaction).toHaveBeenCalledTimes(1);
  });
  it("allows concurrent initialization without duplicate tutors", async () => {
    const store = fixture();
    const results = await Promise.all([initializeLanguageTutorCatalog(), initializeLanguageTutorCatalog()]);
    expect(results.map(result => result.created)).toEqual([100, 0]);
    expect(store.rows()).toHaveLength(100);
    expect(new Set(store.rows().map(row => row.name)).size).toBe(100);
  });
  it("repairs only owned built-ins while retaining same-name private user content", async () => {
    const definition = buildLanguageTutorDefinitions()[0];
    const builtIn = { ...definition, id: 1, status: "inactive", systemPrompt: "Retained custom instructions" } as Agent;
    const privateAgent = { ...definition, id: 2, userId: "fixture-user", isPrivate: true, isTemplate: false } as Agent;
    const store = fixture([builtIn, privateAgent]);
    expect(await initializeLanguageTutorCatalog()).toEqual({ total: 100, created: 99, repaired: 1 });
    expect(store.rows().find(row => row.id === 1)).toMatchObject({ status: "active", systemPrompt: builtIn.systemPrompt });
    expect(store.rows().find(row => row.id === 2)).toEqual(privateAgent);
  });
  it("propagates database failures without committing a partial catalog", async () => {
    const store = fixture([], true);
    await expect(initializeLanguageTutorCatalog()).rejects.toThrow("Fixture insert failure");
    expect(store.rows()).toEqual([]);
  });
});
