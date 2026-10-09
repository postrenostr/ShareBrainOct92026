---
name: Imported dependency security
description: Security-policy and runtime constraints when restoring imported dependencies.
---

Do not bypass the package firewall to restore the imported dependency tree. Check both direct and transitive dependencies, and select supported releases compatible with the project's runtime.

**Why:** Installing this import required multiple attempts: updating direct packages alone left blocked transitive releases, and the latest test tooling required a newer Node runtime than the project uses.

**How to apply:** When dependency installation is blocked, inspect the rejected package names and parent constraints before choosing updates. Preserve the existing runtime unless changing it is necessary and explicitly explained.
