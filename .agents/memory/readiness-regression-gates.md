---
name: Readiness regression gates
description: Readiness notifications must distinguish required blockers from optional evidence conflicts.
---

Approval and fund-release readiness are blocked by unresolved conflicts on required Transaction Record fields, not by every unresolved conflict in the room. Optional or newly discovered evidence may remain visible for review without creating a readiness regression.

**Why:** An optional participant document can add a conflicting or newly discovered field. Treating every conflict as a blocker incorrectly changes both readiness booleans and broadcasts regression emails to unrelated participants.

**How to apply:** Keep the full unresolved-conflict list for review and audit surfaces, but use the required-conflict projection for approval/fund-release gates and regression-event detection. When a participant upload triggers a real regression, scope the notice to the owner and the uploading/affected role; preserve broad recipients only for legacy events without affected-role metadata.