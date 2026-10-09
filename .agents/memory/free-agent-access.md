---
name: Free-agent sign-in
description: Free-agent access must not require card setup or a paid trial.
---

Google sign-in and username setup must allow users to reach the existing free-agent directory and ordinary chat without entering payment details or starting a trial. Paid-feature restrictions must remain in place.

**Why:** The user expected users to be able to sign in and use free agents without paying, and explicitly approved restoring that flow after the payment-page redirects were identified.

**How to apply:** Treat authentication and paid entitlement as separate concerns. Preserve legitimate local chat/invitation destinations during onboarding. Do not implement free access by marking users paid, starting trials automatically, exposing private agents, or removing paid-feature guards.
