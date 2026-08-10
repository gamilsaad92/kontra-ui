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
import { tokenizationPack } from "./tokenization";
import { createGenericPack } from "./genericPackFactory";
import { API_BASE as RESOLVED_API_BASE } from "../apiBase";
import stagesConfig from "../../shared/workflowStages.json";

export const DEFAULT_PACK_ID = "cre_acquisition";

export const PACKS = {
  business_acquisition: businessAcquisitionPack,
  cre_acquisition: creAcquisitionPack,
  fundraising: fundraisingPack,
  tokenization: tokenizationPack,
};

// ── Custom packs (Workflow Pack Builder) ─────────────────────────────────────
// A custom pack is pure JSON persisted server-side (see api/routers/
// workflowPacks.js). It's turned into a working pack at runtime by handing
// its config straight to the same generic factory the hand-written packs
// build on — no per-pack code, no rebuild/deploy needed to add one.
const API_BASE = RESOLVED_API_BASE;
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
  const rawRoles = Array.isArray(config?.roles) ? config.roles : [];
  const normalizedRoles = rawRoles.map((r, index) => ({
    ...r,
    key: String(r?.key || `role_${index + 1}`).trim().replace(/\s+/g, "_"),
    label: String(r?.label || r?.shortLabel || `Participant ${index + 1}`).trim(),
    icon: r?.icon || "👤",
    color: r?.color || "#800020",
  }));
  const normalizedRoleKeys = new Set(normalizedRoles.map((r) => r.key));
  const rawStages = Array.isArray(config?.stages) ? config.stages : [];
  const normalizedStages = rawStages
    .map((s, index) => ({
      ...s,
      key: String(s?.key || `stage_${index + 1}`).trim().replace(/\s+/g, "_"),
      label: String(s?.label || `Stage ${index + 1}`).trim(),
    }))
    .filter((s, index, list) => s.key && list.findIndex((candidate) => candidate.key === s.key) === index);
  const safeStages = normalizedStages.length >= 2
    ? normalizedStages
    : [{ key: "setup", label: "Setup" }, { key: "complete", label: "Complete" }];
  const normalizedDocuments = (Array.isArray(config?.documents) ? config.documents : []).map((d, index) => {
    const assignedTo = Array.isArray(d?.assignedTo)
      ? d.assignedTo
      : d?.assignedRole
        ? [d.assignedRole]
        : [];
    return {
      ...d,
      id: d?.id || `document_${index + 1}`,
      label: String(d?.label || d?.name || `Document ${index + 1}`).trim(),
      section: d?.section || d?.id || `document_${index + 1}`,
      assignedTo: assignedTo
        .map((role) => String(role || "").trim().replace(/\s+/g, "_"))
        .filter((role) => normalizedRoleKeys.has(role)),
    };
  });

  // Custom ws_* packs always show a "Transaction Details" metadata section with
  // generic universal fields. Ensure the primary (first) role has "metadata" in
  // its sections so the panel is visible to the workspace owner.
  const rolesWithDefaults = normalizedRoles.map((r, i) => {
    const role = withRoleCopyDefaults(r, i === 0);
    if (i === 0 && !role.sections?.length) {
      return { ...role, sections: ["metadata"] };
    }
    return role;
  });

  const pack = createGenericPack({
    id: config.id,
    name: config.name,
    description: config.description,
    transactionType: config.transactionType,
    roles: rolesWithDefaults,
    stages: safeStages,
    documentSchema: normalizedDocuments,
    onboardingSteps: config.onboardingSteps,
    // Always include the metadata section so every custom workspace shows the
    // Transaction Details panel with generic fields.
    outstandingItemsSections: ["metadata"],
    metadataLabel: "Transaction Details",
  });
  PACKS[config.id] = pack;
  return pack;
}

export function hasPack(packId) {
  return Boolean(PACKS[packId]);
}

// Fetches + registers a custom pack if it isn't already known. Safe to call
// repeatedly/concurrently for the same id (de-duped), and safe to call for
// built-in ids (no-op). Custom pack failures are deliberately surfaced:
// falling back to CRE makes a valid non-CRE room look like the wrong
// transaction and hides the actual configuration problem.
export async function ensureWorkflowPackLoaded(packId, inlineConfig = null) {
  if (!packId || hasPack(packId)) return getWorkflowPack(packId);
  if (inlineConfig) {
    registerCustomPack({ id: packId, ...inlineConfig });
    return getWorkflowPack(packId);
  }
  if (!pendingFetches[packId]) {
    pendingFetches[packId] = fetch(`${API_BASE}/api/workflow-packs/${packId}`)
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || `Workflow pack request failed (${r.status})`);
        return data;
      })
      .then(data => {
        if (!data?.pack?.config) throw new Error("Workflow pack response was missing its configuration");
        registerCustomPack({ id: data.pack.id, ...data.pack.config });
      })
      .finally(() => { delete pendingFetches[packId]; });
  }
  await pendingFetches[packId];
  if (packId.startsWith("ws_") && !hasPack(packId)) {
    throw new Error(`Workflow pack ${packId} was not registered`);
  }
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

export async function deleteCustomPack(packId) {
  const res = await fetch(`${API_BASE}/api/workflow-packs/${packId}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete pack');
  }
  delete PACKS[packId];
  return true;
}

// deal_type -> pack id. Priority: deal_type inference wins over the stored
// workflow_pack_id column, because (a) that column may not exist yet on
// older/production Supabase schemas (returns undefined), and (b) even where
// it exists its DEFAULT may have overwritten the true pack for rooms created
// before a migration ran. deal_type is always stored correctly and is the
// ground truth captured from the creation form — every place that resolves
// a room's pack (deal room page, checkout success, invite links, etc.)
// should go through this one function instead of reading workflow_pack_id
// directly.
const DEAL_TYPE_TO_PACK = {
  acquisition: DEFAULT_PACK_ID, refinance: DEFAULT_PACK_ID, construction: DEFAULT_PACK_ID,
  flag_conversion: DEFAULT_PACK_ID, sale: DEFAULT_PACK_ID, ground_lease: DEFAULT_PACK_ID,
  full_acquisition: "business_acquisition", asset_purchase: "business_acquisition",
  mbo: "business_acquisition", merger: "business_acquisition",
  business_acquisition: "business_acquisition",
  seed: "fundraising", series_a: "fundraising", series_b_plus: "fundraising", bridge: "fundraising",
  fundraising: "fundraising",
  tokenization: "tokenization", token_issuance: "tokenization", sto: "tokenization",
  security_token: "tokenization", digital_asset: "tokenization",
};

// Keywords in the workspace name that indicate a non-CRE pack.
// Used as a last-resort fallback when both deal_type and workflow_pack_id are absent
// AND the server-side AI classification was not available (e.g. old rooms, offline).
//
// IMPORTANT: 'acquir' and 'acquisition' are intentionally excluded — they match
// real estate deals (hotel acquisition, property acquisition) and would silently
// route CRE rooms to the M&A pack. Only use phrases that unambiguously signal
// a business sale or capital raise context.
const NAME_PACK_HINTS = [
  { pack: 'tokenization',         words: ['tokeniz', 'token issuance', 'token offering', 'security token',
                                          'digital asset', 'sto ', ' sto', 'rwa ', ' rwa',
                                          'real world asset', 'adgm', 'mica ', ' mica', 'reg d token',
                                          'fractionali'] },
  { pack: 'fundraising',          words: ['fundrais', 'capital raise', 'investment round', 'seed round',
                                          'series a', 'series b', 'series c', 'venture', 'vc ', ' vc',
                                          'term sheet', 'safe note', 'convertible', 'raise'] },
  { pack: 'business_acquisition', words: [
      'business acquisition', 'company acquisition', 'corporate acquisition',
      'business purchase', 'buy a business', 'selling a business',
      'asset purchase', 'merger', ' m&a', 'm&a ',
      'management buyout', 'mbo', 'recapitalization',
    ]
  },
];

function inferPackFromName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const { pack, words } of NAME_PACK_HINTS) {
    if (words.some(w => lower.includes(w))) return pack;
  }
  return null;
}

export function resolvePackId(room) {
  if (!room) return DEFAULT_PACK_ID;
  // Custom workspace packs (ws_* IDs) always win — they were explicitly assembled
  // for this specific workspace by the AI generator or Pack Builder and contain the
  // actual roles, documents, and stages chosen at creation time. deal_type inference
  // is a best-effort fallback only for rooms created before the pack system existed;
  // it must never override an explicitly saved custom pack.
  if (room.workflow_pack_id && room.workflow_pack_id.startsWith('ws_')) {
    return room.workflow_pack_id;
  }
  const inferred = room.deal_type ? (DEAL_TYPE_TO_PACK[room.deal_type] ?? null) : null;
  // If deal_type inference points to the CRE default but workflow_pack_id explicitly
  // names a non-default pack, trust workflow_pack_id — the creation form stores it correctly
  // even when deal_type wasn't backfilled on older rooms.
  if ((!inferred || inferred === DEFAULT_PACK_ID) && room.workflow_pack_id && room.workflow_pack_id !== DEFAULT_PACK_ID) {
    return room.workflow_pack_id;
  }
  // Last resort: infer from property name when both deal_type and workflow_pack_id are absent.
  // Prevents AI-generated workspaces from silently falling back to CRE when the pack link failed.
  if (!inferred && !room.workflow_pack_id) {
    const nameInferred = inferPackFromName(room.property_name || room.name);
    if (nameInferred) return nameInferred;
  }
  return inferred ?? room.workflow_pack_id ?? DEFAULT_PACK_ID;
}

// ── Capability system ─────────────────────────────────────────────────────────
//
// Workspace capabilities extend any transaction type with optional behaviour.
// Settlement and Tokenization are the two capabilities implemented here.
//
// getCapabilities(packId, room) — merges pack defaults with room metadata
//   overrides set by the coordinator via workspace settings.
//
// getEffectiveStages(packId, room, baseStages) — injects `settlement` and
//   `complete` stages after the pack's terminal stage when settlement is on.
//
// isInSettlementPhase(dealStage) — treats legacy `funded` rooms with
//   settlement capability as being in the settlement phase (backward compat).

const SETTLEMENT_STAGE_DEFS = (stagesConfig._settlement_stages?.stages || [
  { key: 'settlement', label: 'Settlement' },
  { key: 'complete',   label: 'Complete'   },
]).map(s => ({
  ...s,
  icon: s.key === 'settlement' ? '⚖️' : '✅',
  desc: s.key === 'settlement'
    ? 'Settlement conditions verified and confirmed by all parties'
    : 'Transaction sealed — permanent Transaction Seal created',
}));

// Default capability flags per built-in pack.
// CRE/Business/Fundraising: settlement opt-in (coordinator enables via settings).
// Tokenization pack: settlement always on, tokenization capability always on.
// Custom packs (ws_*): settlement opt-in, tokenization via digital_asset_enabled.
const PACK_CAPABILITY_DEFAULTS = {
  cre_acquisition:      { settlement: false, settlementModes: ['traditional'],            tokenization: false },
  business_acquisition: { settlement: false, settlementModes: ['traditional'],            tokenization: false },
  fundraising:          { settlement: false, settlementModes: ['traditional', 'digital'], tokenization: false },
  tokenization:         { settlement: true,  settlementModes: ['tokenized', 'digital'],   tokenization: true  },
};

/**
 * Return the effective capabilities for a workspace, merging pack defaults
 * with room metadata overrides set by the coordinator.
 *
 * settlement.enabled — true if the pack always has settlement, or if the
 *   coordinator toggled it on via workspace settings.
 * tokenization.enabled — mapped from existing digital_asset_enabled flag
 *   for full backward compatibility.
 */
export function getCapabilities(packId, room) {
  const defaults = PACK_CAPABILITY_DEFAULTS[packId] || {
    settlement: false, settlementModes: ['traditional'], tokenization: false,
  };
  const meta = room?.metadata_values || {};
  const settlementEnabled =
    defaults.settlement ||
    meta.settlement_capability_enabled === true ||
    meta.settlement_capability_enabled === 'true';
  const tokenizationEnabled =
    defaults.tokenization ||
    meta.digital_asset_enabled === true ||
    meta.digital_asset_enabled === 'true';
  return {
    settlement: settlementEnabled,
    settlementModes: defaults.settlementModes,
    tokenization: tokenizationEnabled,
  };
}

/**
 * Return the full ordered stage list for a workspace, injecting `settlement`
 * and `complete` stages after the terminal stage when settlement capability is on.
 *
 * @param {string} packId     - resolved pack id
 * @param {object} room       - deal_rooms row (needs metadata_values)
 * @param {Array}  baseStages - optional override (e.g. stages_config from API)
 */
export function getEffectiveStages(packId, room, baseStages) {
  const caps = getCapabilities(packId, room);
  const pack = getWorkflowPack(packId);
  const stages = baseStages || pack?.stages || [];
  if (!caps.settlement) return stages;
  // Don't duplicate settlement/complete stages (custom pack may already have them).
  const hasSettlement = stages.some(s => s.key === 'settlement' || s.key === 'complete');
  if (hasSettlement) return stages;
  return [...stages, ...SETTLEMENT_STAGE_DEFS];
}

/**
 * Whether a deal_stage value is in the settlement phase.
 * Rooms in `funded` with settlement capability active are treated as being
 * in the settlement stage — no DB migration required.
 */
export function isInSettlementPhase(dealStage) {
  return dealStage === 'settlement' || dealStage === 'funded';
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

export { creAcquisitionPack, businessAcquisitionPack, tokenizationPack };
