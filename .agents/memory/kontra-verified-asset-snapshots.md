---
name: Verified Asset snapshots
description: Immutable, canonical-state-derived Verified Asset and Digital Asset Readiness foundation.
---

Verified Asset snapshots are append-only, versioned records derived from the canonical Transaction Record, full exception history, approvals, provenance, settlement mode, and readiness state. The older verified-asset package remains a compatibility artifact and must not be reused for mutable snapshot semantics.

**Why:** the launch foundation needs an auditable state that later changes cannot rewrite, while preserving existing deal-room and package behavior.

**How to apply:** create a new snapshot only by appending a version; identical source state may return the existing hash/version. Eligibility requires all canonical required fields confirmed, no unresolved blocking exceptions, required approvals satisfied, and intact source provenance. Keep Digital Asset Readiness limited to preparation and external review; never add issuance, custody, wallet, KYC execution, trading, settlement execution, or external integrations here.