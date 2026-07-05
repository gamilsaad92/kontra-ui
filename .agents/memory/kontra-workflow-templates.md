---
name: Kontra workflow-template architecture
description: How CRE deal-room behavior (roles, stages, checklist, health scoring, invites) is now driven by a pluggable workflow template rather than hardcoded per-component.
---

Kontra's deal room used to hardcode CRE-specific roles/stages/checklist/health logic separately inside `DocumentChecklistPanel.jsx`, `DealHealthPanel.jsx`, `DealCoordinationPanel.jsx`, and `InvitePanel.jsx` (each had its own divergent copy of the role list). That coupling has been extracted into `kontra-ui-clone/ui/src/lib/workflowTemplates/` — `creAcquisition.js` defines roles/stages/document schema/health scoring for the "cre_acquisition" template, and `index.js` exposes `getWorkflowTemplate(templateId)` / `DEFAULT_TEMPLATE_ID`.

**Why:** the four panels each had their own near-duplicate role list with slightly different label wording (e.g. "Lender" vs "Lender / Underwriter"), so any future workflow template (servicing, refinance, hazard loss) would have required editing 4+ files in sync. Centralizing avoids drift and lets new templates be added by writing one template module.

**How to apply:** any new UI that needs CRE role/stage/checklist/health data should pull it from `getWorkflowTemplate(templateId)` (default `DEFAULT_TEMPLATE_ID`), not redefine its own list. Note: several peripheral pages (`MyDealRoomsPage.jsx`, `CheckoutSuccessPage.jsx`, `DealSharePage.jsx`, `DealSummaryPage.jsx`) still have their own small local role-label maps for cosmetic badges — these were intentionally left out of the first migration pass (out of task scope) and are a good follow-up if a second workflow template is ever added, since they'd otherwise show wrong labels for non-acquisition templates. The backend (`kontra-ui-clone/api/lib/workflowTemplates.js`, `agentDefinitions.js`, `ai/lib/workflowOrchestrator.js`) was already template/industry-agnostic before this refactor — only the frontend had CRE-specific coupling.
