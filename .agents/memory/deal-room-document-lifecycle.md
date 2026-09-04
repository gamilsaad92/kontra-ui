---
name: Deal room document lifecycle
description: Durable policy for source-document retention, access, and complete room deletion
---

Original deal-room documents remain available for the lifetime of the room and are addressed through server-owned document records rather than client-supplied storage paths. A room deletion is not complete until referenced objects and the room prefix have been removed and re-listed successfully; immutable audit history and verified snapshots remain preserved.

**Why:** Document originals are operational evidence during an active deal, while deletion must not silently leave private storage behind or erase immutable review history.

**How to apply:** Keep storage private, authorize access by room and role, resolve paths only from server-side document metadata, and make cleanup failures retryable and visible.