---
name: Kontra public demo workspaces
description: Public demo rooms reuse the coordinator workspace while serving isolated pack-specific fixtures.
---

Public demo room IDs are presentation-only workspaces: they should resolve to the matching Workflow Pack, use the same coordinator components as a live room, and serve deterministic fixture data without reading real-room records.

**Why:** The old demo presentation drifted from production and made it difficult to validate each pack's lifecycle, documents, Transaction Record, and participant states against the real product.

**How to apply:** Keep demo read endpoints intercepted before production data handlers, seed realistic checklist/record/readiness/activity data per pack, and make every demo write a contained no-op. Do not broaden production authorization to make demos look like owner rooms.

The frontend must keep an explicit set of public demo IDs separate from legacy static sample properties. Public demos fetch their seeded root payload, use the built-in pack immediately, and skip live pack classification.

**Why:** The legacy sample-property map can drift from the seeded demo IDs; relying on it caused demos to enter a mixed synthetic/fixture state and issue unnecessary classification requests.

**How to apply:** Use one shared demo-ID predicate for root loading, pack readiness, coordinator rendering, and classification guards in both mirrored frontend sources.