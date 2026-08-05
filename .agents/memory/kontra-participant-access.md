---
name: Kontra participant access enforcement
description: Participant authorization must be session-derived and enforced across every room read, upload, download, and mutation path
---

Participant role and permissions must come from the verified invite session, never from URL parameters or request-body role fields. Every room API surface—including deep AI uploads, document downloads, tasks, comments, stages, and metadata—must enforce the same session/owner-token boundary server-side, while the UI sends the shared room-auth headers on every request.

**Why:** A participant can bypass a role-scoped UI by calling an endpoint directly, and a missing auth header can make an otherwise valid participant session appear anonymous. Treating only the main room lookup as protected is not sufficient.

**How to apply:** When adding a room endpoint, resolve the verified access context first, derive the effective role server-side, enforce assigned-section permissions for participant document operations, and use `getRoomAuthHeaders(propertyId)` for all corresponding UI reads and mutations.

## Product boundary

Tokenization is an opt-in preparation layer, not the default deal-room experience. A room gets securities jurisdiction, cap-table/token economics, KYC issuance guidance, Asset Readiness, and tokenization exports only when it is a tokenization room or the owner explicitly enables Digital Asset Preparation. Ordinary acquisitions should remain focused on documents, participants, approvals, audit trail, and closing.

**Why:** Customers buy a faster, more organized transaction workspace today; tokenization is a downstream outcome and should not introduce irrelevant regulatory language into non-tokenization deals.

**How to apply:** Gate both UI and API behavior with the same tokenization-or-explicit-layer rule. Suppress stale jurisdiction values from ordinary-room responses and exports, and clear jurisdiction when an enabled layer is turned off.