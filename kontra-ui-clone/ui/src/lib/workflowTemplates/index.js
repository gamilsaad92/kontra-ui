// ── Workflow template registry ──────────────────────────────────────────────
//
// A "workflow template" declares everything that makes a data room type what
// it is: document schema, participant roles, lifecycle stages, and the
// health/next-action logic. The generic UI panels read from whichever
// template is active instead of hardcoding any of this.
//
// CRE Acquisition is the platform's first template. Future templates (CRE
// Servicing, CRE Refinance, CRE Hazard Loss, and eventually non-CRE
// industries) register here the same way, and the panels don't change.

import { creAcquisitionTemplate } from "./creAcquisition";

export const DEFAULT_TEMPLATE_ID = "cre_acquisition";

const TEMPLATES = {
  cre_acquisition: creAcquisitionTemplate,
};

export function getWorkflowTemplate(templateId) {
  return TEMPLATES[templateId] || TEMPLATES[DEFAULT_TEMPLATE_ID];
}

export function listWorkflowTemplates() {
  return Object.values(TEMPLATES).map(t => ({ id: t.id, name: t.name }));
}

export { creAcquisitionTemplate };
