---
name: Kontra Supabase migrations
description: Production Supabase schema migrations and the current connector limitation.
---

Production Supabase migrations are applied through the authenticated Supabase project-management SQL endpoint when the Replit Supabase REST connector is unavailable. The connector may be attached but still return `Proxy configuration error: Invalid URL` before reaching PostgREST.

**Why:** The API's service-role Supabase client supports data API operations but not arbitrary DDL, and the project does not expose a direct Supabase database URL in the workspace.

**How to apply:** Use the canonical SQL file in `kontra-ui-clone/api/migrations/`, submit it as one atomic management SQL request, and verify relations, columns, indexes, and policies afterward. Never print PATs or service-role credentials.