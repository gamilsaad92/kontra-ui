---
name: Digital Asset Preparation Packages
description: Snapshot-bound, provider-neutral preparation package lifecycle.
---

Digital Asset Preparation Packages are append-only artifacts created only by an owner selecting a persisted eligible Verified Asset readiness snapshot. The package stores a deep-frozen snapshot projection plus structured preparation placeholders and source snapshot ID/version/hash.

**Why:** live Transaction Record edits and lifecycle transitions must not silently rewrite a package that may be reviewed externally; the older Verified Transaction Package surface remains compatibility-only and cannot generate from live state.

**How to apply:** require owner authorization and an exact snapshot ID/version, reject missing or ineligible snapshots, persist one immutable package per source snapshot, serve reads/JSON export from the persisted package only, and keep issuance, custody, KYC/AML execution, trading, and settlement execution out of scope.