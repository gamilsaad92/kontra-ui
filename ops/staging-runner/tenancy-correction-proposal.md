# UUID tenancy correction proposal

Proposal only. Do not alter the existing migration files or execute this plan.

## Recommended contract

Use UUID consistently for `public.organizations.id`, `org_memberships.org_id`,
and tenant `org_id` / `organization_id` columns in the Supabase application
schema. This matches the 20260217/20260220 baseline family, root
`001_canonical_schema.sql`, the capital-markets UUID columns, and the separate
UUID app-identity schema. Keep `api/sql/app_identity_schema.sql` as a distinct
database target unless its `APP_DATABASE_URL` is verified to be the same
database.

The empty staging schema makes UUID the lower-risk new-schema choice. It does
not justify running the current BIGINT tenancy migration.

## Existing incompatible paths

- `api/schema-tenancy.sql` creates BIGSERIAL `organizations.id` and BIGINT
  `organization_members.organization_id` / `organization_invites.organization_id`.
  `setup-db` may apply this file among 25 lexicographically ordered
  `schema-*.sql` files.
- `20260320_rls_tenancy.sql` declares BIGINT `ai_reviews.org_id`,
  `current_user_org_ids() RETURNS SETOF bigint`, a BIGINT sentinel, and BIGINT
  organization variables in signup/backfill code. It drops/recreates a UUID
  `ai_reviews.org_id`, which can destroy tenant assignments.
- UUID baseline tables include organizations, org_memberships, loans, assets,
  payments, inspections, draws, escrows, borrower_financials,
  management_items, compliance_items, legal_items, regulatory_scans,
  risk_items, document_reviews, reports, and ai_reviews. Other canonical
  entities also carry UUID organization IDs.
- `20260320` enables RLS on organizations, org_memberships and the listed
  tenant entities, plus pool_loans, trades, audit_log, and tasks. Its
  membership and scoped-table policies use the BIGINT-returning helper.
- `20260322_capital_markets_org_scope.sql` adds UUID `org_id` to
  trade_participants, trade_settlements, and trade_events, then compares those
  values against `current_user_org_ids()`.
- `20260323_dashboard_summary_org_scope.sql` adds UUID `organization_id` to
  ai_reviews, loans, inspections, borrower_financials, payments, and draws;
  its sync trigger copies between `org_id` and `organization_id`, and its
  policies use the same helper.
- `20260320` also creates `handle_new_user()` and an existing-user backfill
  routine with BIGINT organization variables. Both must use the canonical
  type. Audit all helper references, FK definitions, triggers, casts, and
  policy expressions, not only column declarations.
- `api/sql/app_identity_schema.sql` uses UUID organizations and UUID local
  user references; `api/schema-tenancy.sql` instead has `organization_members`
  and `organization_invites`. Do not combine these distinct models without
  confirming callers and database targets.

## Proposed correction sequence

1. Confirm staging has no tenant data and agree UUID as the canonical
   Supabase type.
2. Prepare a new, separately authorized migration that asserts expected
   existing types before changing anything; do not drop/recreate tenant
   columns. For this empty staging database, create the UUID shape directly.
3. Make the tenant helper return UUID, and update signup/backfill variables,
   RLS expressions, FKs, triggers, and organization metadata consistently.
4. Remove the roleless `orgs_member_insert` authorization and add actual
   administrator-role checks to organization and membership writes.
5. Ensure 20260322/23 run only after their base tables exist and match UUID.
6. Test two-tenant reads and writes, cross-tenant reassignment, invalid role
   escalation, and nullable/legacy values before considering release.

