---
name: Transaction Brief canonical projection
description: Keep coordinator Brief recommendations and counts aligned with the Transaction Record panel
---

The coordinator Brief and the Transaction Record panel must resolve required fields from the same combined canonical projection. Do not read `requiredFields` directly for Brief recommendations or counts when hydrated `fields` may contain a newer status.

**Why:** Concurrent or differently timed room-state responses can temporarily contain a stale required-field projection beside newer persisted field rows. Directly trusting the stale array makes the Record show a field as confirmed while the Brief still asks for confirmation.

**How to apply:** Resolve each required field against both canonical arrays, prefer the highest current status consistently with the record panel, and derive confirmation recommendations and counts from that resolved list.