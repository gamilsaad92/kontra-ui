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
import { createGenericPack } from "./genericPackFactory";

export const DEFAULT_PACK_ID = "cre_acquisition";

export const PACKS = {
  cre_acquisition: creAcquisitionPack,
  business_acquisition: businessAcquisitionPack,
  fundraising: fundraisingPack,
};

// ── Custom packs (Workflow Pack Builder) ─────────────────────────────────────
// A custom pack is pure JSON persisted server-side (see api/routers/
// workflowPacks.js). It's turned into a working pack at runtime by handing
// its config straight to the same generic factory the hand-written packs
// build on — no per-pack code, no rebuild/deploy needed to add one.
const API_BASE = import.meta.env.VITE_API_BASE || "";
const pendingFetches = {};

// The Builder UI only collects the fields that shape structure/logic (key,
// label, icon, color, required, needsDocs, invitable) — not per-role
// headline/subtext copy, which built-in packs hand-write. Default those here
// so every custom-pack role still renders a sensible message instead of a
// blank header, without making the builder form ask for prose.
function withRoleCopyDefaults(role, isPrimary) {
  return {
    headline: isPrimary ? "Welcome to your deal room" : "You've been invited to this deal room",
    subtext: isPrimary
      ? `As the ${role.label.toLowerCase()}, you have a full view of all parties, documents, and deal progress. Share the role-specific links below to invite the rest of the team.`
      : role.needsDocs
        ? `As the ${role.label.toLowerCase()}, upload your documents in the checklist above — the rest of the team can track your progress in real time.`
        : `As the ${role.label.toLowerCase()}, you can review the documents and status shared in this deal room.`,
    ...role,
  };
}

export function registerCustomPack(config) {
  const pack = createGenericPack({
    id: config.id,
    name: config.name,
    description: config.description,
    roles: (config.roles || []).map((r, i) => withRoleCopyDefaults(r, i === 0)),
    stages: config.stages,
    documentSchema: (config.documents || []).map(d => ({ ...d, section: d.section || d.id })),
  });
  PACKS[config.id] = pack;
  return pack;
}

export function hasPack(packId) {
  return Boolean(PACKS[packId]);
}

// Fetches + registers a custom pack if it isn't already known. Safe to call
// repeatedly/concurrently for the same id (de-duped), and safe to call for
// built-in ids (no-op). Falls back to the default pack silently on failure
// so a bad/missing custom pack never breaks a deal room's render.
export async function ensureWorkflowPackLoaded(packId) {
  if (!packId || hasPack(packId)) return getWorkflowPack(packId);
  if (!pendingFetches[packId]) {
    pendingFetches[packId] = fetch(`${API_BASE}/api/workflow-packs/${packId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.pack?.config) {
          registerCustomPack({ id: data.pack.id, ...data.pack.config });
        }
      })
      .catch(() => {})
      .finally(() => { delete pendingFetches[packId]; });
  }
  await pendingFetches[packId];
  return getWorkflowPack(packId);
}

export async function fetchCustomPacks() {
  try {
    const res = await fetch(`${API_BASE}/api/workflow-packs`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.packs || []).map(row => {
      registerCustomPack({ id: row.id, ...row.config });
      return PACKS[row.id];
    });
  } catch {
    return [];
  }
}

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
