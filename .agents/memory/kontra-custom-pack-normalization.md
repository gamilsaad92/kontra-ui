---
name: Kontra custom pack normalization
description: AI-generated workspace packs may contain inconsistent role assignments and stage keys.
---

Custom Workflow Pack JSON must be normalized at both creation and client registration boundaries: trim/slugify stage and role keys, deduplicate stages, and reconcile document assignments with the available role list.

**Why:** Generated configurations can assign documents to roles omitted from the role list or include stage keys with leading whitespace; without normalization, a valid deal room can fail during client rendering.

**How to apply:** Keep server-side normalization as the source-of-truth repair for new rooms, and retain client-side normalization for already persisted rooms and older production data.