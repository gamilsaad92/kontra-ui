---
name: Kontra AI Next Action Engine
description: Deal health scoring is LLM-reasoned server-side with a deterministic client fallback, not pure point-deduction rules.
---

`DealHealthPanel.jsx` now calls `POST /api/ai/next-actions` (gpt-4o-mini, JSON mode, in-memory hash-keyed cache) to reason holistically over a deal's actual state (AI-extracted document findings, party submission status, deal stage) rather than relying only on the pack's deterministic `computeHealth()` point-deduction rules.

**Why:** deterministic rules can't capture compounding risk (e.g. two moderate issues that together are urgent) or nuance that depends on deal stage/context. An LLM reasoning over the same inputs gives better prioritized, specific action text.

**How to apply:** the deterministic `pack.computeHealth()` is kept and still called first, synchronously, as an instant fallback shown immediately while the AI call is in flight — and as the permanent result if the AI call fails. The endpoint itself is pack-agnostic: the frontend (which has the active Workflow Pack loaded) sends `requiredDocs`/`requiredRoles` derived from the pack, so the backend never hardcodes CRE vs Business Acquisition concepts. Any new pack gets AI-reasoned health for free as long as it exposes `roles` and `getDocumentSchema()`.
