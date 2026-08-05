---
name: Kontra deploy routing
description: Production API is api/ dir (Render); Vercel frontend follows the GitHub master branch and builds the top-level ui/ directory.
---

# Rule
The GitHub repo gamilsaad92/kontra-ui has two API directories:
- `kontra-ui-clone/api/` — local dev server (localhost:3001)
- `api/` — production server deployed on Render (https://kontra-api.onrender.com)

**Why:** Render deploys from the top-level `api/` directory. Local edits go to `kontra-ui-clone/api/` but must be copied to `api/` before pushing to GitHub for production to pick up the changes.

**How to apply:**
- After editing `kontra-ui-clone/api/lib/pgAdapter.js`, run: `cp kontra-ui-clone/api/lib/pgAdapter.js api/lib/pgAdapter.js`
- After editing `kontra-ui-clone/api/index.js`, run: `cp kontra-ui-clone/api/index.js api/index.js`
- Trigger a Render deploy through the configured Render service control; do not store deploy-hook credentials in project memory.
- UI (Vite app) lives at: `kontra-ui-clone/ui/src/` and is mirrored to `ui/src/`; the Vercel project builds top-level `ui/` and currently follows GitHub `master`, so keep `main` and `master` aligned before frontend deploys.

Note: Supabase production DB needs manual migrations applied in the SQL editor — run SQL from kontra-ui-clone/api/migrations/*.sql in Supabase dashboard.
