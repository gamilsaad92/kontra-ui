---
name: Participant invitation grounding
description: Boundary between required roles, submissions, and invitation history in Kontra AI context
---

An absent `deal_room_invites` row can support only that no current invitation status is recorded for the role. It cannot support the historical claim that the role was never invited. Required-role status comes from the live workflow-pack role definition; submission state comes from `party_submissions`; invitation state comes from an active, unexpired `deal_room_invites` row.

**Why:** Missing participant submissions and missing invitation history are different facts, and conflating them causes Kontra AI to overstate what the durable room state proves.

**How to apply:** Keep submission and invitation fields separate in the grounding context. When invitation state is null, say it is not recorded or unavailable for the current active invite projection; do not say “never invited.”