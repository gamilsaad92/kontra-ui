---
name: Role-scoped AI completion
description: Grounding rule for questions about whether a named participant completed their assigned requirements
---

Participant-completion answers must use the named participant's role-scoped assigned requirements and canonical participant submission state. For legacy rooms without a `party_submissions` row, active evidence tagged with that participant role is the read-time submission projection; transaction-wide missing documents are separate context and must not make that participant incomplete.

**Why:** A participant workspace can be complete for its assigned documents while the transaction still has unrelated outstanding documents. Older rooms may also contain valid role-tagged uploads from before participant-submission synchronization existed. Feeding only the global missing-document list or requiring a new upload causes incorrect blockers.

**How to apply:** Build the role projection from persisted checklist assignments, active document evidence, and `party_submissions` when present; derive legacy submission presence from active role-tagged evidence without writing data. Include required/completed/missing counts and prefer deterministic answers for direct participant questions.