---
name: Kontra Supabase migrations
description: Production Supabase schema migrations and the current connector limitation.
---

Production Supabase migrations are applied through the authenticated Supabase project-management SQL endpoint when the Replit Supabase REST connector is unavailable. The connector may be attached but still return `Proxy configuration error: Invalid URL` before reaching PostgREST.

**Why:** The API's service-role Supabase client supports data API operations but not arbitrary DDL, and the project does not expose a direct Supabase database URL in the workspace.

**How to apply:** Use the canonical SQL file in `kontra-ui-clone/api/migrations/`, submit it as one atomic management SQL request, and verify relations, columns, indexes, and policies afterward. Never print PATs or service-role credentials.

Legacy generated hazard rooms can also be misclassified as CRE when their proposal JSON is missing but their custom pack only says `lending`; schema detection must use the durable hazard identity/description before falling back to generic transaction type.

**Why:** That combination produced the wrong required-field denominator and hid canonical hazard confirmations behind CRE requirements in the live room.

**How to apply:** Treat hazard-loss/casualty/insurance-proceeds identity as generated transaction state, then reconcile existing canonical rows after the authority columns exist.