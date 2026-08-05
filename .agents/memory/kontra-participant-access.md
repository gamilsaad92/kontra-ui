---
name: Kontra participant access enforcement
description: Participant authorization must be session-derived and enforced across every room read, upload, download, and mutation path
---

Participant role and permissions must come from the verified invite session, never from URL parameters or request-body role fields. Every room API surface—including deep AI uploads, document downloads, tasks, comments, stages, and metadata—must enforce the same session/owner-token boundary server-side, while the UI sends the shared room-auth headers on every request.

**Why:** A participant can bypass a role-scoped UI by calling an endpoint directly, and a missing auth header can make an otherwise valid participant session appear anonymous. Treating only the main room lookup as protected is not sufficient.

**How to apply:** When adding a room endpoint, resolve the verified access context first, derive the effective role server-side, enforce assigned-section permissions for participant document operations, and use `getRoomAuthHeaders(propertyId)` for all corresponding UI reads and mutations.