---
name: Kontra CORS regex + screenshot-timing false alarm
description: Real cause of "deal room panels stuck loading forever" and why instant screenshots looked like a hang when it wasn't one.
---

Real bug: the API's CORS allow-origin regex for Replit preview domains (`\.replit\.dev$`, `\.repl\.co$`) didn't account for the `:port` suffix present on preview iframe origins (e.g. `*.replit.dev:5173`), so the browser silently rejected cross-origin responses. Fix: allow an optional `(:\d+)?` suffix in both regexes.

**Why:** curl testing against the same URLs "worked" because curl doesn't enforce CORS — only real browser fetches did, which is why backend logs looked fine while the UI looked broken.

**How to apply:** When "backend works via curl but browser panel never resolves," always check CORS origin-matching regexes for missing port-suffix handling before assuming an app-level JS bug (auth token hang, fetch interceptor, etc).

Second real bug (found later): HTTP/1.1 browser connection pool saturation. The deal room fires 7+ concurrent fetches on mount (analyses, coordination, events, tasks, deal-room, brain/briefing, plus a slow POST to /api/ai/next-actions). With HTTP/1.1 max-6 connections per host, briefing queues behind the slow OpenAI POST and appears to hang. Fix: delay AIOperationsManager's briefing fetch by 400ms (setTimeout) + AbortController with 12s timeout; delay DealHealthPanel's next-actions POST by 800ms (after analyses/coordination resolve). This lets the initial burst settle before the slower/lower-priority calls compete.

Separate trap: single instantaneous screenshots of a freshly-loaded deal room page will always show the loading skeleton — the screenshot tool creates a fresh page load each call and captures at t=0. The 400ms delay means skeleton is EXPECTED in screenshots. Use a Playwright e2e test that explicitly waits (3+ seconds) to confirm actual panel content renders.
