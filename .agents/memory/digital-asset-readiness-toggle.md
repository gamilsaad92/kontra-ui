---
name: Existing-room Digital Asset Readiness
description: Existing rooms opt into readiness through a preserved metadata flag over canonical transaction state.
---

Digital Asset Readiness for an existing room must be enabled by changing only its explicit opt-in flag, then recalculating from the current canonical Transaction Record. It must not recreate room structure, documents, participants, stages, provenance, or verification history. Verified Asset snapshots and preparation packages are historical artifacts; once present, the readiness layer cannot be destructively disabled.

**Why:** Readiness is intentionally downstream of the existing verified transaction state, and historical snapshots/packages must remain reviewable and valid.

**How to apply:** Keep the setting owner-only, preserve unrelated metadata, never generate a snapshot or package as a side effect of enabling, and lock destructive disable when artifact history exists.