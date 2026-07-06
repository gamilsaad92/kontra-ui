---
name: Customer Workflow Builder pattern
description: How custom (user-built) Workflow Packs differ from hand-coded built-in packs, and what that implies for any component consuming `pack`/`roleConfig`.
---

Custom packs are assembled at runtime from a builder UI (`WorkflowPackBuilderPage.jsx`) and persisted server-side (`custom_workflow_packs` table, `/api/workflow-packs` CRUD), then loaded into the same in-memory `PACKS` registry as the hand-coded built-in packs (`registerCustomPack` in `workflowPacks/index.js`) via `ensureWorkflowPackLoaded`/`fetchCustomPacks` on every page that reads a pack.

**Why this matters:** the builder form only collects the fields that shape structure/logic (role key, label, icon, color, required, needsDocs, invitable; stage name/order; document required/ai/metrics). It does NOT collect prose fields that hand-written built-in packs set directly (e.g. `roleConfig.headline`, `roleConfig.subtext`, `roleConfig.sections`). Any deal-room component that reads such a field off `roleConfig`/`pack` without a default will render blank or throw for custom-pack roles, even though the identical code path works fine for built-in packs — because built-in pack authors always supply those fields by hand.

**How to apply:**
- Treat any new field read from `roleConfig` or `pack` as unsafe unless it's one of the structural fields listed above — always guard with `|| []` / `|| ""` or supply a computed default.
- Prefer adding sensible auto-generated defaults centrally in `registerCustomPack` (e.g. `withRoleCopyDefaults`) over scattering `|| fallback` guards across every consuming panel — keeps the builder form simple and new components safe by construction.
- When adding a new panel/component that consumes `pack`/`roleConfig`, test it against a custom pack (not just a built-in one) before considering it done — built-in packs mask missing-field bugs because they set every field a component might expect.
