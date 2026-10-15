# Settlement / canonical-write / active-index proposal

Proposal only. Do not modify existing migration files or execute SQL.

## Settlement compatibility

`018_settlement_atomic_completion.sql` directly inserts a transaction seal
into `deal_analyses` and updates `deal_rooms`. `033_canonical_state_atomicity`
guards ordinary document inserts and requires its authorized canonical-write
context. The current settlement function does not establish that context.

Before combining these migrations:

1. Move seal creation into the authorized canonical transaction-change path,
   or introduce a separately reviewed settlement operation in that path.
2. Preserve one database transaction for readiness validation, seal
   uniqueness, and room completion; retain row/advisory locking and idempotent
   retry semantics.
3. If a dedicated `SECURITY DEFINER` function is proposed, fix its
   `search_path`, restrict execution, verify its owner matches the guard's
   expected owner, and expose no caller-controlled bypass flag.
4. Test authorized completion, direct-insert rejection, duplicate/concurrent
   completion, invalid readiness, rollback on partial failure, and retry.

## Active-version index numbering

`033` comments say a following migration 034 will add a gated active-version
unique index. The candidate release branch already uses 034 for durable
checkout owner access. Keep checkout 034 unchanged. If the index remains
required, assign a new globally unique ID in a separately approved migration.

Before creating that index, inspect duplicate active rows per
`(property_id, section)`, run the intended regression suite, and fail closed
on any ambiguous group. Do not infer that the index exists because 034 has
been applied.
