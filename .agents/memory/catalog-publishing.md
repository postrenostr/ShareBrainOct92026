---
name: Built-in catalog publishing
description: Restoring built-in agents requires a deliberate published-data initialization path.
---

Restore built-in catalogs through a narrowly scoped, idempotent application-data initializer shared by the development seed command and application startup. Do not treat successfully seeding development as proof that the published catalog is restored.

**Why:** The user found the language tutors missing from the live site and wanted the entire catalog restored. Publication must have a reliable way to populate missing built-ins in its own database, without manual production SQL mutations or runtime schema changes.

**How to apply:** Keep built-in ownership distinct from user-owned agents, serialize concurrent initialization, and preserve unrelated/private records and existing nonempty instructions. Clearly distinguish verified development data from live data awaiting a user-approved publication.
