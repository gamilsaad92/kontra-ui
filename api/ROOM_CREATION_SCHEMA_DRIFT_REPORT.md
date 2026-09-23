# Room-creation schema drift report

**Date:** 2026-09-23
**Scope:** production `deal_rooms` writes used by demo/trial checkout, Stripe
checkout completion, and pilot workspace creation. The initial comparison was
read-only; the approved additive remediation was applied afterward without
room-row DML.

## Current write paths

| Path | Relevant `deal_rooms` additions |
| --- | --- |
| Demo/trial checkout | `workflow_pack_id`, `stages_config`, migration-021 generated-room fields, `transaction_entry_mode`, `metadata_values`, and the lifecycle stage |
| Stripe checkout webhook | The same generated-room and lifecycle fields, plus the payment/session fields |
| Pilot admin creation | `workflow_pack_id`, `stages_config`, `owner_write_token`, and `is_pilot` |

The demo/trial and webhook paths must retain the generated-room fields when an
approved proposal exists. They must not create a historical room by silently
dropping those fields.

## Production comparison before remediation

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

Before remediation, production contained 66 `deal_rooms` rows. One row had a
`pilot_` session prefix. No room or transaction data was replayed, deleted, or
rewritten during the comparison. The partial custom workflow-pack state from
the failed historical attempt was left untouched.

## Applied additive remediation

The approval note confirmed that historical activation must remain deferred and
authorized this schema-only repair.

1. Applied the existing `api/migrations/021_generated_room_context.sql`
   definitions unchanged. It adds:

   | Column | Type | Nullability/default |
   | --- | --- | --- |
   | `base_pack` | `text` | nullable, no default |
   | `transaction_type` | `text` | nullable, no default |
   | `transaction_subtype` | `text` | nullable, no default |
   | `transaction_context` | `jsonb` | nullable, no default |
   | `generated_proposal` | `jsonb` | nullable, no default |

   It also adds the existing partial index
   `deal_rooms_generated_transaction_type_idx` on `transaction_type` where
   `generated_proposal IS NOT NULL`.

2. Added and applied `api/migrations/030_pilot_flag.sql`. No earlier
   repository migration defines `is_pilot`; its definition is grounded in the
   pilot API, which writes `true` and treats absent/false as non-pilot:

   ```sql
   ALTER TABLE public.deal_rooms
     ADD COLUMN IF NOT EXISTS is_pilot boolean NOT NULL DEFAULT false;
   ```

   No `is_pilot` index or additional constraint was invented.

3. The DDL ran in one transaction. Existing RLS, policies, primary/unique
   constraints, and unrelated indexes were preserved. Migration 029 was not
   replayed because `transaction_entry_mode` and its check constraint were
   already present.

## Post-remediation verification

- Final definitions: all six missing columns are present with the types and
  defaults above. `is_pilot` is `NOT NULL DEFAULT false`.
- Row count: **66 before / 66 after**.
- Aggregate values after migration:
  - `base_pack`: 66 NULL, 0 non-NULL
  - `transaction_type`: 66 NULL, 0 non-NULL
  - `transaction_subtype`: 66 NULL, 0 non-NULL
  - `transaction_context`: 66 NULL, 0 non-NULL
  - `generated_proposal`: 66 NULL, 0 non-NULL
  - `is_pilot`: 0 NULL, 66 non-NULL, 0 true, 66 false
- No existing room rows were intentionally updated or backfilled. The
  pre-existing `pilot_`-prefixed row remains `is_pilot = false` by design.
- No expected `deal_rooms` column used by the current root room-creation
  upserts remains absent.
- Production API health: Render `https://kontra-api.onrender.com/health`
  returned HTTP 200 with `ok: true`, database `connected`, and configuration
  `configured`.
- Historical activation was not replayed. Harbor Ridge and the partial custom
  workflow-pack state were not modified.

## Server behavior while drift remains

The server now identifies a migration-029 failure only when the database error
explicitly names `transaction_entry_mode` and uses a known missing-column
error code. A missing `base_pack`, another migration-021 field, or an
unidentified schema error remains a generic schema-unavailable failure for
customers, while the detailed database error is retained only in server logs.
Historical creation stays fail-closed in all of those cases.