---
name: Kontra deploy routing
description: Production API is api/ dir (Render). UI changes go to kontra-ui-clone/ui. Always sync api/ before GitHub push.
---

# Rule
The GitHub repo gamilsaad92/kontra-ui has two API directories:
- `kontra-ui-clone/api/` — local dev server (localhost:3001)
- `api/` — production server deployed on Render (https://kontra-api.onrender.com)

**Why:** Render deploys from the top-level `api/` directory. Local edits go to `kontra-ui-clone/api/` but must be copied to `api/` before pushing to GitHub for production to pick up the changes.

**How to apply:**
- After editing `kontra-ui-clone/api/lib/pgAdapter.js`, run: `cp kontra-ui-clone/api/lib/pgAdapter.js api/lib/pgAdapter.js`
- After editing `kontra-ui-clone/api/index.js`, run: `cp kontra-ui-clone/api/index.js api/index.js`
- Trigger Render deploy: `curl -s -X POST "https://api.render.com/deploy/srv-cvugrsmuk2gs738c6dfg?key=Qy-Wr7bDjFU"`
- UI (Vite app) lives at: `kontra-ui-clone/ui/src/` — deployed to Vercel via GitHub actions on gamilsaad92/kontra-ui main branch

Note: Supabase production DB needs manual migrations applied in the SQL editor — run SQL from kontra-ui-clone/api/migrations/*.sql in Supabase dashboard.
