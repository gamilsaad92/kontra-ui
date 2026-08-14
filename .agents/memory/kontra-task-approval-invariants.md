---
name: Kontra task approval invariants
description: Rules for human-approved task execution and its audit trail.
---

- Task approval claim predicates must treat a NULL `execution_status` as not-yet-executing; SQL `!=` alone excludes untouched rows.
- `completed` and `dismissed` task states are resolved and must reject later approval attempts.
- A failed approved action must persist an `action_failed` `deal_events` row carrying actor, source, correlation, idempotency, and outcome metadata.

**Why:** These invariants protect the human-approval gate and make failure recovery/audit behavior observable.

**How to apply:** Preserve these guards when changing `approveTask` or porting the task engine to another persistence adapter.