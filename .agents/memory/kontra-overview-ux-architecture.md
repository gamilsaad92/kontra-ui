---
name: Kontra Overview UX architecture
description: Structure of CoordinatorOverview — lifecycle bar, progressive readiness phases, component slots
---

## Architecture

`CoordinatorOverview` (in `DealRoomPage.jsx`) has three logical areas:

1. **Transaction Snapshot** — workspace name, pack, stage badge, 3-col metric grid, then `StageLifecycleBar` at the bottom (inside the same section)
2. **WhatNeedsAttention** — AI briefing/action cards (always shown)
3. **Phase-conditional readiness panel** — switches based on `readinessPhase`

## Phase computation

```js
const readinessPhase = (() => {
  const k = (currentStageKey || '').toLowerCase();
  if (k.includes('complete') || k.includes('funded')) return 'complete';
  if (k.includes('settlement'))                        return 'settlement';
  if (k.includes('clos'))                              return 'closing';
  return 'transaction'; // default
})();
```

## Phase → panel mapping

| Phase | Component shown |
|---|---|
| `transaction` | `DigitalAssetReadinessSection` with label "Transaction Readiness" |
| `closing` | `DigitalAssetReadinessSection` with label "Closing Readiness" |
| `settlement` | `SettlementReadinessPanel` (existing, full controls) |
| `complete` | `TransactionSealSummaryCard` (fetches /settlement/seal) |

## DigitalAssetReadinessSection props

- `readinessPhase`: controls heading text ('Transaction Readiness' vs 'Closing Readiness')
- `digitalAssetEnabled`: gates the DA sub-block footer; derived from `property.metadata_values.digital_asset_enabled`

**Why:** The categories (Identity & Parties, Asset/Company, Transaction Terms, etc.) are universal transaction-readiness categories. "Digital Asset Readiness" is an optional second capability layer gated on the `digital_asset_enabled` flag. The panel is universal; the DA branding is conditional.

## StageLifecycleBar

Adapted from unmounted OperationsManagerView stage bar. Uses `getEffectiveStages(packId, property, stages)` — this is key because it adds settlement/complete to the bar when settlement capability is enabled, even if the room is at an early stage.

## TransactionSealSummaryCard

New inline component. Fetches `/settlement/seal` endpoint directly (same source as `SealedView` in SettlementReadinessPanel). Renders a compact emerald card with date, conditions %, and "View Seal Record" link.
