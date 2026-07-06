// ── Workflow Pack registry ───────────────────────────────────────────────────
//
// A "Workflow Pack" declares everything that makes a data room type what it
// is: document schema, participant roles, lifecycle stages, and the
// health/next-action logic. The generic UI panels read from whichever pack
// is active instead of hardcoding any of this.
//
// CRE Acquisition is the platform's first pack; Business Acquisition proves
// the engine is genuinely domain-agnostic; Fundraising proves it generalizes
// again to a third, differently-shaped transaction (raising capital rather
// than buying something). Future packs (CRE Servicing, CRE Refinance, CRE
// Hazard Loss, Loan Servicing, and other industries) register here the same
// way, and the panels don't change.

import { creAcquisitionPack } from "./creAcquisition";
import { businessAcquisitionPack } from "./businessAcquisition";
import { fundraisingPack } from "./fundraising";

export const DEFAULT_PACK_ID = "cre_acquisition";

export const PACKS = {
  cre_acquisition: creAcquisitionPack,
  business_acquisition: businessAcquisitionPack,
  fundraising: fundraisingPack,
};

export function getWorkflowPack(packId) {
  return PACKS[packId] || PACKS[DEFAULT_PACK_ID];
}

export function listWorkflowPacks() {
  return Object.values(PACKS).map(p => ({
    id: p.id,
    name: p.name,
    label: p.name,
    description: p.description,
    roles: p.roles,
  }));
}

export { creAcquisitionPack, businessAcquisitionPack };
