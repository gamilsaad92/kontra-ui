---
name: Transaction Brief canonical projection
description: Keep coordinator Brief recommendations and counts aligned with the Transaction Record panel
---

The coordinator Brief, Transaction Record categories, and readiness cards must resolve counts from the same live canonical Transaction Record projection. Secondary readiness responses must not replace a newer dedicated record response.

**Why:** Concurrent or differently timed room-state responses can temporarily contain stale required-field projections beside newer persisted field rows. Raw category rows and slower readiness responses can otherwise make one room show different denominators or resurrect awaiting fields.

**How to apply:** Let the dedicated Transaction Record state own field identity, required counts, and confirmation counts. Derive category summaries from its required fields, and use readiness payloads only for secondary details unless no record projection exists.