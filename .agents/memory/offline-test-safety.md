---
name: Offline test safety
description: Imported test fixtures can bypass mocks and still contact database or AI providers.
---

Placeholder API keys and database URLs do not make tests offline. Explicitly isolate database and provider boundaries, and keep authentication fixtures consistent with the real authentication interface.

**Why:** Imported route tests attempted network requests despite using an in-memory store and dummy credentials. Their mocks covered an older storage/service contract and omitted Passport's authentication method.

**How to apply:** Inspect current endpoint contracts before updating fixtures. Repair stale mocks rather than weakening production authentication or paid-feature checks. Never substitute real account keys or production data merely to make tests pass.
