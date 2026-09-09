---
name: Live verification tracing
description: Evidence sources and limits when tracing a deployed Kontra verification rerun
---

Live verification investigations must establish the deployed Render revision, the exact rerun request timestamp and property ID, the persisted verification payload, and the durable room records used for conflicts and participants. Render logs require the account owner ID; the live verification endpoint can expose normalized facts without room authorization, while participant and transaction-record endpoints require room access.

**Why:** The Replit preview and the production UI/API are separate runtimes, and a verification response can prove that values entered normalization while still hiding a comparison-branch failure.

**How to apply:** Before changing verification code, compare the live payload's normalized facts with the exact deployed source branch and query Supabase room state for conflicts, invites, submissions, and custom-pack role definitions.