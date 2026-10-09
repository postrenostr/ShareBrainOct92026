---
name: Stripe configuration
description: User's direct-key Stripe requirement and the managed publishing restriction encountered earlier.
---

Use the original direct Stripe SDK method with the user's own secret key in Secrets and a separate browser publishable key. Do not introduce the Replit-managed payment method by default.

**Why:** The user explicitly requested the original method after managed Stripe onboarding repeatedly failed to clear the publishing restriction.

**How to apply:** Preserve direct Stripe authentication using STRIPE_SECRET_KEY and ensure the browser key matches its account and mode. Check secret existence before requesting credentials, never request values in chat, and do not disconnect managed integrations automatically.

The previously attached managed Stripe connection triggered “Connect a live Stripe account before publishing” even though the app ran successfully. A connector's added status does not establish a live production association. Changing application code alone may not clear this platform-level restriction; diagnose the remaining managed connection separately.
