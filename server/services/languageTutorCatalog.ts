import { and, eq, inArray, sql } from "drizzle-orm";
import { agents } from "@shared/schema";
import { db } from "../db";
import {
  buildLanguageTutorDefinitions,
  LANGUAGE_TUTOR_OWNER,
  planLanguageTutorCatalog,
} from "./languageTutorDefinitions";

export async function initializeLanguageTutorCatalog() {
  const names = buildLanguageTutorDefinitions().map(row => row.name);
  return db.transaction(async tx => {
    // Transaction-scoped lock serializes catalog updates across CLI runs and
    // autoscale workers. Existing tables suffice; no runtime DDL is performed.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('sharebrain:language-tutor-catalog'))`);
    const existing = await tx.select().from(agents).where(and(
      eq(agents.userId, LANGUAGE_TUTOR_OWNER),
      inArray(agents.name, names),
    ));
    const plan = planLanguageTutorCatalog(existing);
    if (plan.create.length) await tx.insert(agents).values(plan.create);
    for (const repair of plan.repair) {
      await tx.update(agents).set({ ...repair.values, updatedAt: new Date() })
        .where(and(eq(agents.id, repair.id), eq(agents.userId, LANGUAGE_TUTOR_OWNER)));
    }
    return { total: plan.total, created: plan.create.length, repaired: plan.repair.length };
  });
}
