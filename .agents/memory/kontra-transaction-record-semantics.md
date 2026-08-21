---
name: Kontra Transaction Record semantics
description: Durable rules for canonical values, workflow requirements, suggestions, and dependent Transaction Record fields.
---

The Transaction Record is an operational coordination layer, not a legal or regulatory determination system. A field marked workflow-required means the workspace workflow configured it as necessary; it must not be presented as legally, regulatorily, or contractually required.

**Why:** users need to distinguish Kontra's workflow checklist from external obligations, while AI-generated transaction-specific fields should remain suggestions until a pack rule or coordinator action promotes them.

**How to apply:** schema fields should carry separate workflow-required, summary-priority, and suggested/expected semantics. Repeated concepts should use one canonical key with display aliases, and extraction/manual entry must normalize aliases before persistence. Dependency rules should make downstream fields non-applicable when a confirmed prerequisite is N/A rather than leaving them outstanding. Summary completeness is factual record completeness—not deal health—and should count extracted, confirmed, manually entered, and setup-seeded values separately while excluding N/A items from the denominator.

Field history is an append-only audit stream for extraction, manual edits, confirmations, N/A propagation, conflicts, and source changes. A later document may change provenance and status, but must not overwrite a coordinator-verified value.

**Why:** the Transaction Record is the product-wide factual source of truth, so reviewers need to distinguish a new document disagreement from an intentional correction without losing the previously confirmed value.

**How to apply:** keep the current field row authoritative for reads, expose history per field, preserve verified values on `source_changed`, and apply dependency cascades as explicit N/A rows when the prerequisite is marked N/A.

Demo and overview summaries must derive category membership and counts from the resolved pack schema plus canonical record state; never maintain a second generic field-definition list for seeded demos. Display-only aliases such as target-close must be marked non-renderable and resolve to the canonical closing-date fact.

**Why:** a separate generic summary list treated valid pack-specific fields as missing and counted a target-close alias twice, causing the Overview percentage, Key Facts, and detailed Transaction Record to disagree.

**How to apply:** use `getRequiredRecordFields`/`getPackRecordSchema` with `recordState.requiredFields`, exclude non-renderable aliases, and let N/A fields leave the required denominator while remaining visible in the full state.

Document-derived conflict backfills must honor a coordinator-resolved conflict before recreating it during a read-after-write hydration. A later source may reopen the field, but the same evidence must remain resolved.

**Why:** conflict resolution updates durable field and conflict rows before recalculation; re-scanning the unchanged documents in that same recalculation can otherwise resurrect the blocker and make every derived surface disagree.

**How to apply:** compare resolved conflict timestamps with the newest relevant evidence before upserting a document-derived conflict, and resolve the selected conflict ID rather than every conflict sharing a field key.

Generated Transaction Record schemas may use a different machine key than the persisted field row. Required-state reconciliation may match a unique generated label as a compatibility fallback, and key-fact summaries must not truncate away populated confirmed fields.

**Why:** generated rooms can persist a canonical field from document extraction under a legacy/category key; exact-key-only matching made a confirmed value count as missing, while fixed first-N summaries hid later confirmed facts.

**How to apply:** prefer canonical key matches, then unique normalized labels for generated required definitions; include populated confirmed/conflict/awaiting generated fields in Key Transaction Facts even when they fall beyond the initial summary window.