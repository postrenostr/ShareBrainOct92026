---
name: Google login domain
description: User's domain requirement for Google login on this ShareBrain copy.
---

The user wants Google login on `sharebrains.net`, with the exact production callback `https://sharebrains.net/auth/google/callback`, without an `/api` prefix.

**Why:** The user requested their own domain rather than the Replit development domain, and explicitly supplied this callback URL.

**How to apply:** Preserve the exact user-selected production callback. Keep development's separate callback for compatibility; do not present its preview URL or `/api` callback path as the production setup.
