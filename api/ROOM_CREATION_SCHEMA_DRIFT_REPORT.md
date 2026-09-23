# Room-creation schema drift report

**Date:** 2026-09-23
**Scope:** production `deal_rooms` writes used by demo/trial checkout, Stripe
checkout completion, and pilot workspace creation. This is a read-only
comparison; no production migration or data mutation was performed.

## Current write paths

| Path | Relevant `deal_rooms` additions |
| --- | --- |
| Demo/trial checkout | `workflow_pack_id`, `stages_config`, migration-021 generated-room fields, `transaction_entry_mode`, `metadata_values`, and the lifecycle stage |
| Stripe checkout webhook | The same generated-room and lifecycle fields, plus the payment/session fields |
| Pilot admin creation | `workflow_pack_id`, `stages_config`, `owner_write_token`, and `is_pilot` |

The demo/trial and webhook paths must retain the generated-room fields when an
approved proposal exists. They must not create a historical room by silently
dropping those fields.

## Read-only production comparison

Confirmed present on the production `deal_rooms` table:

- `transaction_entry_mode`
- `workflow_pack_id`
- `stages_config`
- `deal_stage`
- `metadata_values`
- `link_token`
- `owner_write_token`

Confirmed absent:

- `base_pack`
- `transaction_type`
- `transaction_subtype`
- `transaction_context`
- `generated_proposal`
- `is_pilot`

The five generated-room columns are the complete column set declared by
`021_generated_room_context.sql`. `transaction_entry_mode` is therefore not
the current production column drift; its presence is also why a missing
`base_pack` error must not be reported as migration 029.

No room or transaction data was replayed, deleted, or rewritten during this
audit. The partial custom workflow-pack state from the failed historical
attempt was left untouched.

## Smallest safe migration plan

Do not apply this plan until the comparison has been reviewed and authorized.

1. Apply the existing `api/migrations/021_generated_room_context.sql` unchanged.
   It is additive and creates the five missing columns plus the partial index
   for generated proposals. It does not rewrite existing room data.
2. Add and apply one separate additive migration for the pilot flag, because
   no canonical migration for that existing write-path column is present:

   ```sql
   ALTER TABLE deal_rooms
     ADD COLUMN IF NOT EXISTS is_pilot boolean NOT NULL DEFAULT false;

   CREATE INDEX IF NOT EXISTS deal_rooms_is_pilot_idx
     ON deal_rooms(property_id)
     WHERE is_pilot;
   ```

3. Do not use migration 029 as the fix for this drift. The production
   `transaction_entry_mode` column is already present. If constraint parity
   is separately required, inspect the constraint first and only then
   re-run the idempotent 029 migration through the approved Supabase path.
4. After the migrations are authorized and applied, verify the full set of
   room-creation columns before replaying any activation. No activation
   replay is part of this report.

## Server behavior while drift remains

The server now identifies a migration-029 failure only when the database error
explicitly names `transaction_entry_mode` and uses a known missing-column
error code. A missing `base_pack`, another migration-021 field, or an
unidentified schema error remains a generic schema-unavailable failure for
customers, while the detailed database error is retained only in server logs.
Historical creation stays fail-closed in all of those cases.