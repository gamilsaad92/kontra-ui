---
name: Settlement Capability Layer
description: Architecture of the provider-neutral Settlement Readiness layer added in the settlement implementation session (Tasks A–F).
---

## What was built

**Phase 1** settlement capability — a provider-neutral coordination layer. No chain connectivity, no payment execution, no custody.

### DB schema (migration 017)
Added to `deal_rooms`: `settlement_mode`, `settlement_mode_locked_at`, `settlement_readiness_pct`, `sealed_at`, `completed_at`.
Added to `deal_analyses`: `post_completion BOOLEAN DEFAULT false`, `post_completion_added_at TIMESTAMPTZ`.

**Migration not yet applied to Supabase — held until user approves deploy (Task G).**

### Capability activation
- Settlement is a **workspace capability**, not a transaction type.
- Tokenization pack: always has settlement + tokenization capability.
- CRE/Business/Fundraising packs: opt-in via `metadata_values.settlement_capability_enabled = true`.
- UI: `getCapabilities(packId, room)` in `workflowPacks/index.js` merges pack defaults + room metadata.

### Stage injection
- `getEffectiveStages(packId, room, baseStages)` appends `settlement` + `complete` stages when capability is on.
- These stages are NOT stored in `stages_config` — they're injected at render/API time.
- Advance endpoint also extends VALID stages when `roomHasSettlementCapability(room)` is true.

### Settlement lifecycle
```
closing → settlement → [POST /settlement/complete] → complete
```
- Advancing to `settlement` is a normal stage advance.
- Advancing to `complete` via the regular advance endpoint returns 400 COMPLETE_GATE.
- `POST /settlement/complete` validates all conditions, creates Transaction Seal, sets sealed_at/completed_at, advances deal_stage to 'complete' atomically.

### Settlement API routes (all under /api/public/deal-room/:transactionId)
- `GET /settlement/readiness` — returns capability status, mode, scored conditions list, unmet list
- `PATCH /settlement/mode` — set mode (traditional/digital/tokenized)
- `PATCH /settlement/mode/lock` — lock mode (irrevocable without support)
- `POST /settlement/complete` — deterministic gate + creates Transaction Seal + seals workspace
- `GET /settlement/seal` — returns the Transaction Seal record

### Settlement modes
Provider-neutral free-text fields. Three modes:
- `traditional`: funding_confirmed, settlement_date, evidence_doc_ref + coordinator + legal approvals
- `digital`: expected_amount + coordinator + compliance approvals  
- `tokenized`: token_type, issuance_provider, whitelist_confirmed, legal_opinion_present + all 3 approvals

### Completion gate (deterministic, never score-based)
Score is informational only. `all_conditions_met` requires EVERY condition to be `met=true`. Fields must have `status='verified'`; approvals must have `action='approved'`. Checked fresh in `computeSettlementReadiness()` on each POST /settlement/complete call.

### Immutability scope after sealing
ONLY `transaction_record_fields` become immutable (PATCH returns 400 WORKSPACE_SEALED).
The workspace itself (participants, documents, events) remains usable.
Documents uploaded after sealing get `post_completion: true` in `deal_analyses`.

### UI components
- `SettlementReadinessPanel.jsx` — shown when workspace is in settlement/complete stage + capability active
- `SealedView` (inside SettlementReadinessPanel) — shown after sealing
- Legacy `SettlementPanel` — shown in closing stage as pre-settlement preparation (unchanged)

### Mock isolation (Task B)
- `tokenRegistry.js`: exports `IS_PRODUCTION_DISABLED` flag; logs warning at startup in production
- `tokenizationApi.js`: middleware blocks all registry-dependent routes with 503 MOCK_DISABLED in production; safe routes remain active (/assess, /contract/abi, /contract/preflight, /contract/encode-kyc-data, /contract/assessment-history)
- `commandCentersApi.js`: router middleware adds `X-Data-Source: fixture` and `_fixture: true` to all responses

**Why:** tokenRegistry is in-memory only (Map/array), resets on restart, generates fake data. Must never be presented as live data in production.

## What stays held (Task G)
- DB migration 017 not yet applied to Supabase
- Changes not yet pushed to GitHub
- Render deploy not yet triggered
- User must approve before any of these run
