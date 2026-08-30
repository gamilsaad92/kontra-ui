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

Active evidence comparisons must validate the value shape against the shared semantic type before creating or retaining a conflict. Identifier prose containing numbers is not an amount; unrelated values must be non-comparable and automatically removed from live conflict state during hydration.

**Why:** the existing six-document Hazard Loss room confirmed that this rule removes the false facility-name/principal conflict while leaving all fields awaiting confirmation and preserving the generic pending-review notice.

**How to apply:** use the shared semantic taxonomy for extraction, verification facts, and stored-conflict reconciliation; keep genuine same-concept amount discrepancies comparable.

Demo and overview summaries must derive category membership and counts from the resolved pack schema plus canonical record state; never maintain a second generic field-definition list for seeded demos. Display-only aliases such as target-close must be marked non-renderable and resolve to the canonical closing-date fact.

**Why:** a separate generic summary list treated valid pack-specific fields as missing and counted a target-close alias twice, causing the Overview percentage, Key Facts, and detailed Transaction Record to disagree.

**How to apply:** use `getRequiredRecordFields`/`getPackRecordSchema` with `recordState.requiredFields`, exclude non-renderable aliases, and let N/A fields leave the required denominator while remaining visible in the full state.

Document-derived conflict backfills must honor a coordinator-resolved conflict before recreating it during a read-after-write hydration. A later source may reopen the field, but the same evidence must remain resolved.

**Why:** conflict resolution updates durable field and conflict rows before recalculation; re-scanning the unchanged documents in that same recalculation can otherwise resurrect the blocker and make every derived surface disagree.

**How to apply:** compare resolved conflict timestamps with the newest relevant evidence before upserting a document-derived conflict, and resolve the selected conflict ID rather than every conflict sharing a field key.

Generated Transaction Record schemas may use a different machine key than the persisted field row. Required-state reconciliation may match a unique generated label as a compatibility fallback, and key-fact summaries must not truncate away populated confirmed fields.

**Why:** generated rooms can persist a canonical field from document extraction under a legacy/category key; exact-key-only matching made a confirmed value count as missing, while fixed first-N summaries hid later confirmed facts.

**How to apply:** prefer canonical key matches, then unique normalized labels for generated required definitions; include populated confirmed/conflict/awaiting generated fields in Key Transaction Facts even when they fall beyond the initial summary window.

Generated room hydration must treat a verified Transaction Record row as coordinator-owned state and never overwrite it from the proposal snapshot; conflict resolution must recover the field by canonical key when a legacy conflict points at a removed row.

**Why:** room generation and re-entry can run after confirmation, and legacy alias cleanup can leave a conflict row without its original field ID. Re-syncing or resolving only the stale ID otherwise makes a confirmed value disappear from readiness.

**How to apply:** skip proposal synchronization for verified/confirmed/source-changed rows, and have conflict resolution update or recreate the authoritative field before marking the selected conflict resolved.

Legacy coordinator confirmations may exist only in the activity stream, so state hydration must be able to promote the matching persisted field row from a field ID/key or an exact label confirmation event.

**Why:** older rooms can show a confirmed Recent Change while their field row remains extracted, making every current-state surface disagree even though the audit trail proves the coordinator action.

**How to apply:** reconcile the latest confirmed field-history or field-specific activity event before computing readiness, while never overriding a newer source conflict.

Generated AI rooms must materialize every approved proposal field as a durable record row at creation, including null values; proposal JSON may describe generation context but cannot supply field values or definitions after materialization.

**Why:** allowing the proposal snapshot to remain a parallel field source caused Key Facts, accordions, counts, and confirmation state to disagree after refresh and room re-entry.

**How to apply:** persist definition identity, category, requiredness, source type, and unresolved candidates on the field row; project generated-room UI and readiness from those rows, with proposal fallback only for pre-migration compatibility.

Action-feed suppression must match historical wording variants as well as canonical field keys, including reordered phrases such as “borrower advanced funds” versus “borrower funds advanced.”

**Why:** persisted briefing/task text can outlive the extraction schema that produced it, so exact label or key matching alone can leave a stale action beside the authoritative record state.

**How to apply:** normalize aliases and semantic word-order variants before rendering briefing actions, then prefer the confirmed/current record row when duplicate candidates share one canonical identity.

Policy limits, repair costs, insurance proceeds, and borrower cash advances are separate financial concepts even when the same evidence contains all of their amounts; only explicitly related evidence may be compared.

**Why:** Hazard Loss documents commonly put coverage limits beside repair estimates, and treating every nearby dollar value as repair evidence creates false blockers and stale actions.

**How to apply:** give each concept its own canonical semantic identity, require strict typed amount parsing, and keep policy-limit/threshold checks in verification relationships rather than same-field Transaction Record conflict state.