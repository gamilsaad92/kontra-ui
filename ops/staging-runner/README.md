# Staging migration infrastructure proposal

This directory is a development proposal only. Nothing here is wired into
application startup, Replit Preview, Render, or a workflow. The runner is
execution-disabled in the proposed manifest and was not run against a database.

Candidate migration source: root `api/` at
`b6deb3dd903c4b2371c4f9e5fc10309a605d198f`.

## Manifest tracks

- `api/migrations/`: deal-room and related schema changes.
- `api/supabase/migrations/`: organization/domain and RLS track.
- `api/sql/app_identity_schema.sql`: separately targeted app database; marked
  excluded from the Supabase runner.
- `api/schema-*.sql`: 25 legacy bootstrap files invoked by `setup-db`, not
  included in the manifest. Their ordering and overlap must be resolved first.
- `api/sql/user_properties.sql`, `api/scripts/production-setup.sql`, and seed
  files are not silently included.

The manifest IDs include their source namespace to disambiguate repeated
numeric/date prefixes. SHA-256 checksums pin the proposed source bytes.
Dependencies describe a proposed ordering, not proof that each migration is
safe or in scope. Any `blockers` entry is an execution stop.

The manifest bytes are separately pinned in the runner. Each migration is read
only from its blob at the exact approved source commit and checked against the
manifest SHA-256; working-tree migration files are never used as a fallback.
The runner executes only the verified Git-blob bytes.

## Pinned source availability

The approved source repository is
`https://github.com/gamilsaad92/kontra-ui.git`. The approved source ref is
`refs/heads/staging/release-5524f393-security-checkout`, and it must resolve to
`b6deb3dd903c4b2371c4f9e5fc10309a605d198f`.

The runner never fetches source objects. Before planning, an operator must
explicitly retrieve the approved ref over verified HTTPS and confirm the exact
commit:

```sh
git -c http.sslVerify=true fetch --no-tags \
  https://github.com/gamilsaad92/kontra-ui.git \
  +refs/heads/staging/release-5524f393-security-checkout:refs/remotes/kontra-pinned-source/phase2g
test "$(git rev-parse --verify 'refs/remotes/kontra-pinned-source/phase2g^{commit}')" = \
  "b6deb3dd903c4b2371c4f9e5fc10309a605d198f"
```

The runner requires `origin` to be this same HTTPS repository and rejects
credentials embedded in its URL, a missing pin ref, or a ref that resolves to
any other commit. The explicit fetch URL and refspec retrieve only the approved
repository ref; if it moves or the exact source object is unavailable, stop and
request a new source review. Do not fetch a replacement branch or silently
update the pin. The source SHA and manifest digest are fixed in the runner, and
every manifest path must resolve to a blob at that commit whose bytes match its
protected SHA-256.

Git verification is bound to the runner's resolved worktree and Git directory.
Subprocesses receive a controlled environment: inherited `GIT_*` variables are
discarded, global and system configuration are disabled, optional Git locks and
lazy object fetching are disabled, and commands use explicit `--git-dir` and
`--work-tree` arguments. The runner rejects a redirected object directory or
any `objects/info/alternates` file. Local URL rewrites are expanded by Git and
then rejected unless the effective origin is the approved HTTPS repository.

These checks establish content identity, not author identity: the pinned Git
commit ID and the protected per-file SHA-256 values verify the expected
contents, but do not independently prove who authored or approved that commit.
That approval must come from the separate source review and pinning process.

## Runner use

`node ops/staging-runner/staging-migration-runner.js --plan` is intended to
perform local manifest/source checks only. It must not connect to a database.
Apply mode remains disabled until separate approval, explicit staging
authorization, and a reviewed manifest change. Do not pass production
credentials or invoke this runner against any database as part of this
proposal.

The runner holds a session-level PostgreSQL advisory lock on the same
dedicated connection used for ledger and migration operations. PostgreSQL
releases that lock when the session disconnects; a later run still rejects
any `started` ledger entry for manual reconciliation.

## Security-bootstrap gate and recovery

`security-bootstrap-proposal.sql` is blocked by default. It requires an
explicit psql approval variable, a separate ACL-review attestation, read-only
inspection of `pg_default_acl`, and authority for both `postgres` and
`supabase_admin`. The SQL revokes global as well as `public`-schema defaults
for tables, sequences, functions, and types, including grants to `PUBLIC`.
Revoking `PUBLIC` function/type access can affect Supabase-managed operations;
do not set either approval variable without an approved, role-specific impact
plan. Those privileges cannot be assumed from the current workspace: no
database was queried during this phase.

Required read-only ACL inspection (review role, schema, object kind, grantee,
and privileges before authorizing the bootstrap):

```sql
SELECT owner.rolname AS object_owner,
       COALESCE(ns.nspname, '<global>') AS schema_name,
       d.defaclobjtype AS object_kind,
       CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
       acl.privilege_type,
       acl.is_grantable
FROM pg_catalog.pg_default_acl AS d
JOIN pg_catalog.pg_roles AS owner ON owner.oid = d.defaclrole
LEFT JOIN pg_catalog.pg_namespace AS ns ON ns.oid = d.defaclnamespace
CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS acl
LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE owner.rolname IN ('postgres', 'supabase_admin')
ORDER BY owner.rolname, schema_name, object_kind, grantee, acl.privilege_type;
```

Also confirm `current_user` is authorized for each target role using
`pg_has_role(current_user, 'postgres', 'MEMBER')` and the equivalent check for
`supabase_admin`, or that the caller is a superuser. Do not infer authority
from the connection string.

The bootstrap body runs inside one PostgreSQL transaction. A failure before
commit rolls back its DDL and ACL changes. If the connection is lost during
commit, inspect `pg_namespace`, `pg_class`, `pg_default_acl`, and effective
grants before deciding what occurred. If `kontra_internal` or its ledger
already exists after a partial bootstrap, the script intentionally stops;
inspect ownership, columns,
constraints, and ACLs, then perform an approved forward repair. Do not drop
existing objects as recovery.

The optional local PostgreSQL integration test accepts only loopback URLs for
databases named `kontra_test_*`. It runs the original bootstrap gates, and only
passes explicit approval variables for its disposable local target. It does
not read or fall back to Supabase variables.

## Unresolved

- Live Render repository, branch, Blueprint path, and deployed commit are not
  verified. The committed nested Render blueprint's `rootDir: api` resolves
  from repository root and therefore describes root API if Render uses it.
- `APP_DATABASE_URL` and the actual target of `migrate:app-db` are unverified.
- The current staging database has no Kontra application objects or ledger;
  there is no basis to mark these files applied.
- The UUID/BIGINT tenancy conflict, 018/033 compatibility, the 033 index
  comment versus checkout 034, and broad default privileges remain blockers.
- The exact global and schema-specific default ACL rows have not been
  inspected; bootstrap execution therefore remains blocked.
