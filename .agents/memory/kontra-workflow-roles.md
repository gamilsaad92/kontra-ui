---
name: Kontra universal participant role metadata
description: Role label/icon/color/invite-copy lives in shared/workflowRoles.json, scoped per Workflow Pack — never a flat cross-pack dict
---

# Rule
Any place that shows a role's display name, icon, color, or invite copy (emails, event log, deal room UI, comments) must look it up scoped to the active pack — via `getPackRoleLabel(packId, roleKey)` / `getPackRoleConfig(packId)` on the backend, or `pack.getRole(roleKey)` on the frontend (`getWorkflowPack(packId)` from `ui/src/lib/workflowPacks`). Never reintroduce a flat `{ lender: 'Lender / Underwriter', ... }`-style dict keyed only by role, since the same role key can mean something different in another pack (e.g. `lender` in `cre_acquisition` vs `business_acquisition`).

**Why:** Before this, ~7 hardcoded role maps (5+ in the backend across invite/notification/event-log functions, plus `DealRoomPage.jsx` `ROLE_CONFIG` and `CommentsPanel.jsx` `ROLE_COLORS` on the frontend) each duplicated role metadata keyed flatly by role string. Business Acquisition's `lender`/`broker` roles silently fell through to CRE Acquisition's `ROLE_CONFIG.lender`/`.broker` entries — wrong label, color, headline, and sections for that pack.

**How to apply:**
- Single source of truth: `shared/workflowRoles.json` (root + `kontra-ui-clone/shared/` synced copy), keyed by packId → `roles[]`, each with `key/label/shortLabel/icon/color/required/needsDocs/invitable/inviteAction/canManage/headline/subtext/sections`.
- Backend (`api/index.js`, mirrored to `kontra-ui-clone/api/index.js`): `getPackRoleConfig(packId)`, `getPackRoleLabel(packId, roleKey)`, `getRoomPackId(propertyId)` — every notify/invite function must select `workflow_pack_id` from `deal_rooms` and pass it through.
- Frontend: pack modules (`ui/src/lib/workflowPacks/{creAcquisition,businessAcquisition}.js`) export `roles` derived from the JSON; `DealRoomPage.jsx`/`CommentsPanel.jsx` resolve role metadata via `getWorkflowPack(packId).getRole(role)`, never a local map.
- Same pattern as `workflowStages.json` (lifecycle stages) — follow that precedent when adding new pack-scoped, cross-cutting metadata.
