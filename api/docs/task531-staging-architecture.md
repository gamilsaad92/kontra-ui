# Task #531 staging architecture

## Decision

Ship the current Deal Room security boundary separately and defer institutional
organization membership and lending/portfolio modules. The verified staging
project contains Deal Room, task, and transaction-record tables, but not
organization, membership, profile, loan, application, collections, or report
tables.

Deal Room owners authenticate through a verified, room-scoped HttpOnly session
established by the email OTP/one-use exchange flow. Participants authenticate
through an accepted, room-bound invite and participant session. Every owner
operation uses the same server-side session resolver in every environment.
Organization roles do not grant room access; a future bridge requires an
explicit room-ownership/association flow that does not infer identity from email.

## Current release scope

- Preserve Deal Room owner sessions, participant sessions, room-specific role
  permissions, document access, transaction records, workflow packs, and
  readiness/approval routes.
- Ignore and strip legacy owner-token headers and body fields before route
  handling. Raw `owner_write_token` values are not an authorization credential
  and are no longer placed in checkout or pilot URLs or browser storage.
- Keep owner room-list access behind email OTP. Room analytics, deletion,
  billing-portal creation, and other owner operations are scoped to the
  verified owner session for that room.
- Keep the signed-in owner UI hint non-secret; only the HttpOnly cookie grants
  access. Same-origin/API requests include cookies, and the client removes
  legacy owner-token fields from JSON requests.
- Keep public Deal Room and v2 invite routes outside organization membership
  authentication.
- In verified staging isolation only, return `501 TASK531_MODULE_DEFERRED` for
  organization administration, organization selection, lending, servicing,
  portfolio, dashboard, reporting, collections, and mobile-lending APIs.
  Production keeps its existing institutional and lending API behavior.
- Do not apply the proposed UUID membership migration or legacy February/March
  organization migrations to the verified staging database.

## Deferred scope and prerequisites

Before enabling organization APIs, design a migration for the verified target
that creates only the required canonical organization and membership tables,
uses Supabase Auth UUIDs, and does not create lending tables solely for legacy
routes. Reconcile `org_memberships` with the existing `organization_members`
and `profiles` code expectations, and define an explicit, owner-authorized
bridge before organization members can access a Deal Room.

The existing local `20260320_rls_tenancy.sql` source uses a BIGINT
`current_user_org_ids()` helper and text user IDs; it must not be applied ahead
of a future UUID design. The staging project currently has no such helper or
signup trigger. `deal_events.org_id` is nullable text and needs an explicit
mapping decision if it is ever brought into organization tenancy.

## Migration and rollback plan

The verified staging database already has the complete `deal_room_tasks` table
required by the current task list, refresh, approve, and dismiss operations.
It has the required task columns, primary key, property/status and execution
indexes, correlation index, and generated-task uniqueness index. Its
`property_id` is `text`, matching the unique `deal_rooms.property_id`; the task
table has RLS enabled with no client policy, so API access must continue through
the service-role client and the room-session checks.

No database migration is needed for the task table or owner-session schema. Do
not run
`supabase db push` from the combined migration directory: the local migration
history contains legacy tenancy migrations that are not in the verified
staging history. No database state is changed by deploying this release.

If the API release must be rolled back, redeploy the prior API version. There is
no schema rollback because this release applies no migration. A future
membership migration requires a separately reviewed forward and rollback plan.

## Owner-session correction

`api/lib/roomSessionAccess.js` resolves both participant sessions and owner
sessions from hashed, unexpired database sessions and their matching,
room-scoped invites. `api/index.js`, `api/routers/aiDealReview.js`, and
`api/routers/tasks.js` use this resolver. Participant sessions retain their
role restrictions and take precedence when explicitly supplied.

The email-verified My Deal Rooms flow returns one-use exchange capabilities;
each is exchanged for a short-lived cookie scoped to that room's API path.
Paid checkout and pilot access links no longer carry reusable owner tokens;
users enter through My Deal Rooms and verify their email. The owner-session
exchange input remains only for the initial one-use session exchange.

Generic API routers that are mounted at `/api` now yield `/api/public/deal-room`
requests to the dedicated Deal Room handlers instead of applying unrelated
organization or lending authentication first. Those handlers still enforce
their existing owner-session or participant-session checks; this routing change
does not authorize access by itself.

Legacy email-only room listing, analytics, deletion, and billing endpoints are
blocked. The supported dashboard reads and destructive/account actions use a
room-scoped owner session. Participant invite verification and document access
continue to use their independent participant session.

## Verification status

The earlier Task #531 baseline passed 134 selected tests. After the final
routing and staging-boundary corrections, the affected isolated API Jest run
passed 6 suites and 93 tests with `--detectOpenHandles`; the affected clean-env
UI Jest run passed 5 suites and 17 tests. Six source/config Node checks and the
static test-isolation verifier also passed. The earlier 20 API Node tests and
3 UI checkout-handoff Node tests were not rerun after these final edits.

Owner document-review requests now use
`/api/public/deal-room/:propertyId/ai/...`, and task approve/dismiss requests use
`/api/public/deal-room/:propertyId/tasks/:taskId/...`. Both paths match the
existing HttpOnly cookie Path; the cookie’s Secure, HttpOnly, SameSite, and
room-scoped attributes are unchanged. AI upload authorization resolves the
room from the path and rejects a conflicting body room. Task actions query the
task by both ID and room ID before resolving the owner session. The old
non-room-scoped task actions return 410. The unused global
`send-invite-email` route was removed; the UI uses the room-scoped
`create-invite` endpoint, which creates the invite and sends its email.

Legacy owner-token header and body spellings are removed from JSON requests,
including `owner_write_token`; AI multipart uploads also discard those fields
before authorization. The browser no longer constructs owner-token fields for
checklist or task operations. OTP exchange and participant access continue to
use their existing independent session flows.

The module-deferral middleware is now enabled only when
`stagingEnvironment.enabled` is true. The standard `ui/vercel.json` still points
to staging and is unchanged from the comparison baseline; use only
`render.staging.yaml` and `ui/vercel.staging.json` for a staging release.

## Staging schema compatibility check

The database target was verified by project metadata as Supabase project
`jpemuoapbgzwapydqiio` (`kontra-staging-checkout`, `ACTIVE_HEALTHY`). Only
schema catalogs and migration metadata were inspected; no customer rows were
read and no schema or data was changed.

`public.deal_room_tasks` exists and has all 37 columns used by the current task
engine: `id uuid`, `property_id text`, `task_type text`, `title text`,
`description text`, `owner_type text`, `owner_role text`, `status text`,
`evidence jsonb`, `draft_action jsonb`, `source_type text`, `source_id text`,
`due_at timestamptz`, `created_at timestamptz`, `updated_at timestamptz`,
`severity text`, `blocking boolean`, `category text`,
`source_document_id text`, `source_page integer`, `source_excerpt text`,
`source_agent text`, `source_run_id text`, `correlation_id uuid`,
`required_approver_role text`, `rejection_reason text`,
`send_back_reason text`, `decision text`, `decision_actor_id text`,
`decision_actor_role text`, `decision_reason text`, `decision_at timestamptz`,
`idempotency_key text`, `execution_status text`, `execution_result jsonb`,
`executed_at timestamptz`, and `resolved_at timestamptz`. The primary key is
`id`. Its indexes are the primary-key index, `(property_id, status)`,
`(property_id, execution_status, status)`, `correlation_id`, and a partial
unique index on `(property_id, task_type, source_type, source_id)` when
`source_id` is non-null. The table has no other constraints or foreign keys.
There are no task-table triggers or task-specific database functions.

Room scoping is compatible with the current identifiers: `deal_rooms.property_id`
is unique `text`; owner sessions are keyed by a checked 64-character hash and
have a `property_id` foreign key to the room. Participant sessions are keyed by
their unique text token hash and reference UUID invite rows. RLS is enabled on
these tables. Session/invite and room policies restrict direct access; the task
table has no client RLS policy and therefore relies on the service-role API
client plus the application’s room-session resolver. Task rows do not have a
foreign key to rooms, so the route’s explicit task/room match remains required.

The remaining incompatibility is in task refresh, not the task table:
`taskEngine.js` asks `party_submissions` for a `status` column, but staging has
no such column. The current submission API explicitly treats
`party_submissions` as canonical presence, document count, notes, and submission
time; it rejects lifecycle-status changes. Adding a `status` column would
contradict that established contract, so no migration was prepared. The task
engine now retries only this specific missing-column error with the supported
columns, while retaining status-aware behavior in environments whose schema
actually has that field. Other query errors are returned unchanged. This avoids
discarding existing submission rows and falsely creating “missing participant”
tasks in staging.

Because the verified staging schema has no submission lifecycle status, refresh
cannot generate `pending_submission` reminder tasks from that table there. This
is a narrower feature limitation, not a schema blocker for task listing,
refresh, approval, or dismissal. No status column or migration is recommended
without a separate product/schema decision.

Staging migration history does not contain the local `007_deal_room_tasks`
migration even though the task table and later task indexes exist. This is
history drift, not a missing table; do not replay combined migrations. No
organization-membership or institutional-lending tables or migrations were
added. No production database, migration, service, commit, push, or deployment
was used.

## Manual staging verification

1. Confirm the API points to the verified staging Supabase project.
2. Exercise owner email OTP, owner-session exchange/logout, and owner-only room
   mutations for a synthetic test room.
3. Exercise participant invite OTP/session access and verify role restrictions.
4. Verify a participant or owner session for one room cannot access another
   room or another invite.
5. Confirm document URLs remain private and room-scoped.
6. Confirm deferred organization/lending routes return `501
   TASK531_MODULE_DEFERRED` only on isolated staging and do not query missing
   tables; confirm production does not enable the deferral flag.
7. Confirm task listing, refresh, approval, and dismissal against a synthetic
   staging room. Confirm refresh retains existing `party_submissions` rows and
   does not generate a false missing-participant task; pending-submission
   reminders are not available with the current status-less schema.
8. Confirm `/health` remains available and no unapproved migration was run.

## Release recommendation

GO for staging schema compatibility: `deal_room_tasks` and owner-session storage
are present and support the current room-scoped task operations. No database
migration is required or recommended. The code-side submission query fallback
passed its three focused Node tests and static syntax/diff checks. Pending
submission reminder generation remains unavailable with the current
status-less `party_submissions` contract. Staging deployment and synthetic-room
verification have not been performed and require separate approval.
Organization membership, organization selection, lending, portfolio,
collections, and institutional reporting remain deferred. No staging
deployment was performed.
