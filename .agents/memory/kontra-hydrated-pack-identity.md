---
name: Kontra hydrated pack identity
description: Transaction State must preserve a custom room's persisted workflow pack during downstream grounding.
---

Resolve the workflow pack from the already-hydrated room row whenever Transaction State has loaded that row; do not re-query by passing the room object to a property-ID helper or rely on a lookup that can silently default to CRE.

**Why:** A custom hazard-loss room was otherwise interpreted as the built-in CRE pack, causing stale participant tasks and role names to leak into AI blockers and answers even though the live People configuration was correct.

**How to apply:** Treat the room's persisted `workflow_pack_id` as authoritative for state hydration, then derive live participant definitions from that pack before filtering tasks or prompting AI.