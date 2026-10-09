---
name: Language lesson experience
description: User-described behavior of the original language teaching experience.
---

The user said that previously, asking the Catalan tutor for "lesson 1" returned ten words and ten sentences in Catalan, with a Play button to hear the sound.

The user chose to restore this lesson format and Play Audio for all 100 language tutors, not just Catalan.

**Why:** The user reported this existing behavior when comparing the restored catalog with the original tutors. Catalog availability alone does not reproduce that experience.

**How to apply:** Preserve the ten-word, ten-sentence lesson format and playable pronunciation when restoring teaching behavior. Do not assume enabling catalog entries reproduces audio functionality, and do not generate paid audio in bulk without explicit authorization.

Bulk HD replacement must be an explicitly triggered, one-time production operation using the published app's connection. Preserve exact lesson text, retain successful completion across deployments, and require explicit retries for unsuccessful work. Do not run it during normal startup or redeployment.

**Why:** The user explicitly requested this controlled production route after repeated confusion between workspace script access and published-app database access. Redeployments must not create repeated paid recordings.

**How to apply:** Treat publication as making the maintenance control available, not as consent to start paid regeneration. Keep production execution and its reported results separate from development verification.
