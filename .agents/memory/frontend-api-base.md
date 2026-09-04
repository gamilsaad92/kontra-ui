---
name: Frontend API base resolution
description: Hosted Kontra UI builds must route API calls through the shared API-base resolver
---

Use the shared frontend API-base resolver for every production API request; do not read an ad hoc Vite variable in a page component.

**Why:** The hosted UI and API are deployed separately. A stale or misspelled environment variable makes requests fall back to the frontend origin, producing generic 404-style failures before the API can log or authorize the request.

**How to apply:** When adding or repairing UI API calls, import the shared `API_BASE` value and verify its production build resolves to the deployed API origin while local development continues to use the configured proxy.