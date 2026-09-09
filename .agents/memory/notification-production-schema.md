---
name: Production notification schema
description: Durable schema constraints for participant hydration and event-driven notification delivery
---

The production `party_submissions` model represents participant presence with rows and contains `property_id`, `role`, `name`, `email`, document fields, and `submitted_at`; it does not include an active/inactive `status` column. Event-driven notification hydration must select only those canonical columns rather than assuming a lifecycle status field.

**Why:** A live dispatcher invocation failed before recipient resolution when it selected the absent column. The notification migration is separate and must be verified against live `deal_notifications` columns and indexes, not inferred from source presence.

**How to apply:** Before changing participant filtering, inspect the live schema. Treat migration 028 as an additive prerequisite for idempotent delivery, and keep schema compatibility fixes limited to unsupported reads unless the participant model genuinely requires a new field.