---
name: Kontra deal room identifier conventions
description: The canonical property identifier in deal rooms is the URL slug, not the DB UUID
---

# Rule
Always use `propertyId` from `useParams()` (the URL slug, e.g. "my-deal-001") as the canonical identifier for deal_rooms and party_submissions — not `property.id` (the PostgreSQL UUID primary key).

**Why:** The deal_rooms table has two columns: `id` (UUID PK) and `property_id` (text slug). The checkout/demo endpoint creates rows keyed on the slug. The DealRoomPage fetches by slug. Using `property.id` (UUID) as the propertyId prop caused a mismatch — coordination fetches hit a UUID that had no submissions, while submissions were stored under the slug.

**How to apply:**
- `DealCoordinationPanel propertyId={propertyId || property.property_id || property.id}`
- `DealIntelligenceDashboard propertyId={propertyId || property.property_id || property.id}`
- `buildPendingSectionMap(property, role, onAnalysisSaved, propertyId)` — pass URL propertyId as 4th arg
- Submit API calls (`POST /api/public/deal-room/:propertyId/submit`) use the URL slug automatically
