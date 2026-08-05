---
name: Kontra deploy routing
description: Production API is api/ dir (Render); Vercel frontend follows the GitHub master branch and builds the top-level ui/ directory. Replit preview uses the local API/database.
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
- Vercel branch split: Production builds track `main`, Preview builds track `master` (2026-08 Vercel dashboard: Production green on `main`, Preview red on `master` because it builds with `npm install`). The deterministic `npm ci` install fix (commit `aaa496c3` on `main`) was published to `main` only — `master` is intentionally untouched (user constraint), so Vercel Preview may still build with `npm install` until `master` is updated.
- Vercel can build the UI with `ui/` as its project root, so imports from `ui/src` must not reach outside that root. Keep workflow metadata under each UI's `src/shared`; root-only `shared/` files make clean Vercel builds fail even when repository-root builds pass.
- Vercel's clean install hit npm `Exit handler never called!` with lifecycle scripts enabled; `npm ci --ignore-scripts --no-audit --no-fund` completed and the Vite build passed. Use `--ignore-scripts` in all Vercel install commands for this UI.
- A local Replit preview can return 404 for production-only rooms even when the Render API returns 200; validate production rooms against `https://kontra-api.onrender.com`, not the local preview API.
- Local API (`kontra-ui-clone/api`) reads **local Postgres**, not Supabase: `db.js` prefers `DATABASE_URL` (Replit Postgres via pgAdapter) whenever it is set, even if real Supabase creds exist. Production-created rooms (e.g. checkout/trial) never exist locally, so the local preview 404s them. To fix the preview, sync the room row + its `custom_workflow_packs` row from Supabase REST (service role) into local Postgres with jsonb columns stringified and `on conflict (property_id)`/`(id)` upserts.

Note: Supabase production DB needs manual migrations applied in the SQL editor — run SQL from kontra-ui-clone/api/migrations/*.sql in Supabase dashboard.
