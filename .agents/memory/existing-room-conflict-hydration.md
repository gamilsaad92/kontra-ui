---
name: Existing-room conflict hydration
description: Live transaction-state handling for stale persisted conflicts during additive schema rollout
---

The live transaction-state response must filter semantically retired persisted conflicts in memory before readiness, Next Actions, Transaction Record, or Operations Manager consume it. A best-effort database update alone is insufficient; an older runtime/schema may leave the unresolved row visible on the immediate re-read. Legacy field-level conflict projections must be cleared in the same returned state so they cannot recreate a synthetic blocker.

**Why:** An existing hazard-loss room continued exposing the compatible `Hazard loss` / `Hazard loss - fire` pair even though the semantic tests passed. The durable resolution write can be rejected by a partially rolled-out additive schema, while downstream queries still return the old unresolved row.

**How to apply:** During hydration, retain the active evidence snapshot and retired conflict identity from reconciliation. Filter returned conflict rows with the same semantic support predicate and normalize matching legacy field rows before computing canonical readiness and blockers. Preserve genuine sibling conflicts.