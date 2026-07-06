---
name: Kontra stage-key coupling (workflow pack limitation)
description: Deal room lifecycle stage keys (uploading/under_review/approved/closing/funded) are still hardcoded in several frontend files, not fully pack-driven
---

# Limitation
Unlike roles (fully pack-scoped via `shared/workflowRoles.json`) and documents (fully pack-scoped via each pack's `getDocumentSchema`), the five lifecycle stage *keys* themselves (`uploading`, `under_review`, `approved`, `closing`, `funded`) are still assumed as literal string constants in several frontend files, not read generically from `shared/workflowStages.json`:
- `kontra-ui-clone/ui/src/pages/public/MyDealRoomsPage.jsx` (`const stages = ["uploading", ...]`)
- `kontra-ui-clone/ui/src/pages/public/DealSharePage.jsx`
- `kontra-ui-clone/ui/src/pages/public/DealCoordinationPanel.jsx`
- `kontra-ui-clone/ui/src/pages/public/DealRoomPage.jsx` (`setStatus("uploading")` etc.)
- Backend default: `deal_rooms.deal_stage` DB column defaults to `'uploading'`.

**Why this matters:** Every pack today (`cre_acquisition`, `business_acquisition`, `fundraising`) reuses the same 5 stage keys with pack-specific *labels* only (e.g. fundraising's `approved` is labeled "Term Sheet Signed"). This works today, but a future pack needing a genuinely different stage count/sequence (e.g. a pack with 3 stages, or one needing a stage between existing ones) would require touching these frontend files, breaking the "add a pack with zero panel changes" promise that already holds for roles and documents.

**How to apply:** When adding a new pack, keep to the existing 5 stage keys (only vary labels/icons/desc in `shared/workflowStages.json`) unless you're also prepared to generalize the files above to read from `getPackStageKeys()`-equivalent logic on the frontend. Generalizing stage keys fully is a good candidate for a future sprint if a pack ever needs a different stage shape.
