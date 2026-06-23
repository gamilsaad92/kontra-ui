---
name: Kontra pgAdapter RLS issue
description: Local dev PostgreSQL RLS silently blocks pgAdapter pool reads, returning empty arrays
---

# Rule
When a table has `ALTER TABLE x ENABLE ROW LEVEL SECURITY` applied on the local Replit PostgreSQL, the pgAdapter connection pool returns empty arrays for SELECT queries — silently, with no error — even if rows exist.

**Why:** PostgreSQL enforces RLS for non-superuser connections. The pgAdapter pool connects as a regular user. Even a `USING (true)` policy needs to be matched. In local dev there's no service-role concept — RLS is meant for Supabase production only.

**How to apply:**
- Fix 1 (immediate): `psql "$DATABASE_URL" -c "ALTER TABLE x DISABLE ROW LEVEL SECURITY;"`
- Fix 2 (defensive): add `pool.on('connect', (client) => { client.query('SET row_security = off').catch(() => {}); });` in pgAdapter.js getPool()
- Both are already applied in this codebase
- Diagnose by testing with: `psql "$DATABASE_URL" -c "SET row_security = off; SELECT * FROM x;"` — if this returns rows but the API returns empty, RLS is the culprit
