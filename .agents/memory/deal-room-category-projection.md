---
name: Deal-room category projection
description: Why Transaction Record category rows need their own canonical projection boundary
---

The Transaction Record category UI must canonicalize and deduplicate both schema definitions and matched record rows before grouping, counting, or rendering. A canonical server readiness projection does not guarantee unique UI categories because the room page can combine static pack definitions, generated definitions, and room-state definitions through a separate path.

**Why:** A live room can show duplicate Seller, Buyer, Transaction Structure, or Closing Date rows while server readiness state is already deduplicated. Matching raw field keys alone also leaves aliases split across categories.

**How to apply:** Treat canonical identity as the source of truth at the category projection boundary, preserve the canonical conflict state and provenance, and never fix this class of bug by patching displayed counts or mutating room data.