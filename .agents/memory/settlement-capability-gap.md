---
name: Settlement capability detection gap
description: Two places where settlement_mode was not included in DB selects, causing roomHasSettlementCapability to always return false for non-tokenization rooms.
---

## The rule
`roomHasSettlementCapability(room)` must receive a `room` object that includes `settlement_mode`. Any handler that calls this function must SELECT `settlement_mode` from `deal_rooms`.

## Two gaps found in production deployment

### 1. roomHasSettlementCapability itself
The original function only checked `workflow_pack_id === 'tokenization'` and `metadata_values.settlement_capability_enabled`. It did not check `settlement_mode`. So setting `settlement_mode = 'traditional'` via the PATCH endpoint had no effect on capability detection.

**Fix:** Added `!!room?.settlement_mode` as the first (highest-priority) check.

### 2. Advance handler room SELECT
`app.post('/advance')` selected only `workflow_pack_id, deal_stage, stages_config, metadata_values` — no `settlement_mode`. This caused `settlementCapableAdv = false` for all non-tokenization rooms, so 'settlement' was never added to the VALID stage array.

**Fix:** Added `settlement_mode` to the SELECT.

## Why
- `settlement_mode` was added as a new column in migration 017. The original capability check predated it.
- Neither bug caused a 500 — both silently returned `capability_enabled: false`, making it look like the feature wasn't activated rather than a code bug.

## How to apply
Any future handler that calls `roomHasSettlementCapability(room)` or reads settlement capability from the room must include `settlement_mode` in its `deal_rooms` SELECT. Grep for `roomHasSettlementCapability` when adding new settlement-aware routes.
