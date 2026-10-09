---
name: Database environment identification
description: Misleading workspace environment labels and safe development/production checks.
---

Do not infer the connected database environment from `REPLIT_ENVIRONMENT` alone. This workspace has reported `production` while read-only metadata confirmed that development and published production use separate databases.

**Why:** A development-only integration test was incorrectly blocked by that label. Replit's official documentation identifies `REPLIT_DEPLOYMENT=1` as the published-process marker; it was not set in the workspace.

**How to apply:** Use the published-process marker for runtime guards and explicitly scoped, read-only database metadata when confirming development versus production readiness. Do not change credentials or execute production migrations merely because of the workspace label.
