---
name: Vercel deployment inspection
description: What to do when the installed Vercel connection cannot inspect the live deployment
---

An installed Vercel connection using an API key may return a structured `403` with `invalidToken: true` for otherwise valid deployment and project queries.

**Why:** Live deployment verification depends on the provider API, but API-key recovery is not an OAuth reconnect flow and the key value must never be handled in chat.

**How to apply:** Do not use OAuth reauthorization. Ask the owner to repair or replace the Vercel key or its provider permissions and update the existing Replit connection; until then, report deployment SHA, URL, and live-flow acceptance as unverified.