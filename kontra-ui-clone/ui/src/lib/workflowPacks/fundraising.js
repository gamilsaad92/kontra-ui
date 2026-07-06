// ── Fundraising workflow pack ────────────────────────────────────────────────
//
// The platform's third pack, proving the engine generalizes beyond "buying
// something" (CRE Acquisition, Business Acquisition) to "raising capital" —
// a different transaction shape (a round, not a purchase) with its own
// roles (founder/investor/counsel/auditor/banker instead of
// owner/lender/buyer/seller) and documents (term sheet, cap table, SAFE/SPA
// instead of purchase agreements). It's built the same way as Business
// Acquisition: pure data on top of the shared engine — no panel or engine
// code changes required.
//
// Like Business Acquisition, financials and audited financials route
// through the platform's universal AI extraction endpoint
// (POST /api/ai/analyze-document) via each schema entry's `aiExtraction`
// metadata, so no new backend route was needed for AI to reason over this
// pack's documents either.

// ── Roles ────────────────────────────────────────────────────────────────────
// Read from shared/workflowRoles.json — single source of truth shared with
// the backend's pack-agnostic role labels (see creAcquisition.js).
import rolesConfig from "../../../../shared/workflowRoles.json";

export const roles = rolesConfig.fundraising.roles;

export function getRole(key) {
  return roles.find(r => r.key === key) || null;
}

export function getRoleLabel(key, { short = false } = {}) {
  const r = getRole(key);
  if (!r) return key;
  return short ? (r.shortLabel || r.label) : r.label;
}

// ── Lifecycle stages ─────────────────────────────────────────────────────────
// Reuses the platform's five-stage lifecycle keys (uploading/under_review/
// approved/closing/funded) with round-specific labels — the same approach
// Business Acquisition takes. Stage *keys* are still shared across packs
// today (several panels compare against these keys directly), so a new pack
// customizes labels/icons/desc, not the key set, until that's generalized
// further.
import stagesConfig from "../../../../shared/workflowStages.json";

const STAGE_META = {
  uploading:    { icon: "📤" },
  under_review: { icon: "🔍" },
  approved:     { icon: "✅" },
  closing:      { icon: "✍️" },
  funded:       { icon: "🤝" },
};
const STAGE_DESC = {
  uploading:    "Founder & investor exchanging diligence documents",
  under_review: "Investor & counsel reviewing submissions",
  approved:     "Term sheet signed — finalizing definitive agreements",
  closing:      "Signing in process",
  funded:       "Round closed — capital wired",
};

export const stages = stagesConfig.fundraising.stages.map(s => ({
  ...s,
  ...(STAGE_META[s.key] || {}),
  desc: STAGE_DESC[s.key] || "",
}));

export const nextStage = {
  uploading:    "under_review",
  under_review: "approved",
  approved:     "closing",
  closing:      "funded",
};

export const advanceLabel = {
  uploading:    "Move to Under Review",
  under_review: "Mark Term Sheet Signed",
  approved:     "Begin Closing",
  closing:      "Mark as Funded",
};

// ── Document schema ──────────────────────────────────────────────────────────
const DOCUMENT_SCHEMA = [
  { id: "term_sheet",         label: "Term Sheet",                section: "term_sheet",         ai: false, required: true },
  { id: "cap_table",          label: "Cap Table / Ownership",      section: "cap_table",          ai: false, required: true },
  { id: "financials",         label: "Financial Statements",       section: "financials",         ai: true,  required: true,
    aiExtraction: {
      analystRole: "venture/growth investor's financial analyst reviewing a startup raising a round",
      docTypes: ["Income Statement", "Balance Sheet", "Cash Flow Statement", "Financial Statements", "Other"],
      metrics: {
        mrr: "monthly recurring revenue in dollars",
        arr: "annual recurring revenue in dollars",
        burn_rate: "net monthly cash burn in dollars",
        runway_months: "months of runway remaining at current burn rate",
        yoy_growth: "year-over-year revenue growth as a percentage",
      },
    } },
  { id: "audited_financials", label: "Audited Financials",         section: "audited_financials", ai: true,  required: false,
    aiExtraction: {
      analystRole: "independent auditor reviewing audited financial statements for an investment round",
      docTypes: ["Audit Report", "Audited Financial Statements", "Other"],
      metrics: {
        audited_revenue: "audited trailing twelve month revenue in dollars",
        revenue_variance_pct: "percentage variance between audited and previously reported revenue",
        material_weaknesses: "number of material weaknesses or significant deficiencies identified",
      },
    } },
  { id: "spa",                 label: "Stock Purchase Agreement / SAFE", section: "spa",                 ai: false, required: true },
  { id: "disclosure_schedule", label: "Disclosure Schedule",       section: "disclosure_schedule", ai: false, required: false },
];

const DOLLAR_METRIC_PATTERN = /revenue|mrr|arr|burn|capital|adjustments/i;

function humanizeMetricKey(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    .replace(/Mrr/, "MRR").replace(/Arr/, "ARR").replace(/Yoy/, "YoY").replace(/Pct/, "%");
}

export function getDocumentSchema(_dealSubtype) {
  return DOCUMENT_SCHEMA;
}

// ── Extraction rules: generic over whatever metrics a doc's aiExtraction
// schema declares — no per-metric-name code, so new metrics just show up. ──
export function getInlineFacts(analysis, section) {
  if (!analysis || typeof analysis !== "object" || analysis.pending) return [];
  const doc = DOCUMENT_SCHEMA.find(d => d.section === section);
  const metricDefs = doc?.aiExtraction?.metrics;
  const metrics = analysis.metrics;
  if (!metricDefs || !metrics) return [];

  return Object.keys(metricDefs)
    .filter(key => metrics[key] != null)
    .map(key => ({
      label: humanizeMetricKey(key),
      value: DOLLAR_METRIC_PATTERN.test(key)
        ? `$${Number(metrics[key]).toLocaleString()}`
        : `${metrics[key]}${key.includes("pct") || key.includes("growth") ? "%" : ""}`,
      type: "neutral",
    }));
}

export function getCompletenessIssues(analysis, section) {
  if (!analysis || typeof analysis !== "object") return [];
  const issues = [];
  (analysis.risk_flags || []).forEach(flag => issues.push({ text: flag, sev: "Moderate" }));
  if (section === "financials" && analysis.metrics?.runway_months != null && Number(analysis.metrics.runway_months) < 6) {
    issues.push({ text: "Less than 6 months of runway remaining — flag for urgent diligence", sev: "Critical" });
  }
  return issues;
}

export const factColors = {
  good: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  warn: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  neutral: { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
};

// ── Upload routing: financials and audited financials route through the
// platform's universal AI extraction endpoint; everything else uses the
// generic lightweight tracking endpoint. ────────────────────────────────────
export const aiUploadEndpoints = Object.fromEntries(
  DOCUMENT_SCHEMA.filter(d => d.ai).map(d => [d.section, "/api/ai/analyze-document"])
);
export const trackSections = new Set(DOCUMENT_SCHEMA.map(d => d.section));

// ── Outstanding Items grid — no CRE-only equivalents (NOI/DSCR/occupancy)
// apply to a fundraising round; the Deal Intelligence + Financial Snapshot
// dashboards below are this pack's equivalent instead. ─────────────────────
export const outstandingItemsSections = [];

// ── Dashboard ────────────────────────────────────────────────────────────────
export const intelligenceSections = [
  { key: "financials",         icon: "📈", label: "Financials",          color: "#16a34a" },
  { key: "audited_financials", icon: "🧾", label: "Audited Financials",  color: "#2563eb" },
];

function runwayBadge(months) {
  if (months == null) return null;
  const n = Number(months);
  if (n >= 18) return { label: "Healthy Runway", color: "#16a34a" };
  if (n >= 6) return { label: "Moderate Runway", color: "#d97706" };
  return { label: "Low Runway", color: "#dc2626" };
}

export function getIntelligenceBadge(section, analysis) {
  if (!analysis) return null;
  const metrics = analysis.metrics || {};
  if (section === "financials") return runwayBadge(metrics.runway_months);
  if (section === "audited_financials") {
    const variance = Math.abs(Number(metrics.revenue_variance_pct) || 0);
    if (variance > 15) return { label: "Large Variance", color: "#dc2626" };
    if (variance > 5) return { label: "Some Variance", color: "#d97706" };
    return { label: "Confirmed", color: "#16a34a" };
  }
  return null;
}

export function getIntelligenceHighlight(section, analysis) {
  if (!analysis) return null;
  const metrics = analysis.metrics || {};
  if (section === "financials" && (metrics.arr != null || metrics.mrr != null)) {
    return `ARR: $${Number(metrics.arr || 0).toLocaleString()}${metrics.burn_rate != null ? ` · Burn: $${Number(metrics.burn_rate).toLocaleString()}/mo` : ""}`;
  }
  if (section === "audited_financials" && metrics.audited_revenue != null) {
    return `Audited Revenue: $${Number(metrics.audited_revenue).toLocaleString()}${metrics.revenue_variance_pct != null ? ` (${metrics.revenue_variance_pct}% variance)` : ""}`;
  }
  return null;
}

// ── Dashboard: Financial Snapshot rollup — generic over whatever metrics
// each document's aiExtraction schema declares. ────────────────────────────
export function getSnapshotStats(bySection) {
  const fin = bySection.financials?.metrics || {};
  const aud = bySection.audited_financials?.metrics || {};
  return [
    { label: "MRR", value: fin.mrr != null ? `$${Number(fin.mrr).toLocaleString()}` : null },
    { label: "ARR", value: fin.arr != null ? `$${Number(fin.arr).toLocaleString()}` : null },
    { label: "Burn Rate", value: fin.burn_rate != null ? `$${Number(fin.burn_rate).toLocaleString()}/mo` : null },
    { label: "Runway", value: fin.runway_months != null ? `${fin.runway_months} mo` : null },
    { label: "YoY Growth", value: fin.yoy_growth != null ? `${fin.yoy_growth}%` : null },
    { label: "Audited Revenue", value: aud.audited_revenue != null ? `$${Number(aud.audited_revenue).toLocaleString()}` : null },
  ].filter(s => s.value);
}

export function getSnapshotFlag(bySection) {
  const fin = bySection.financials?.metrics || {};
  const aud = bySection.audited_financials?.metrics || {};
  if (fin.runway_months != null && Number(fin.runway_months) < 6) {
    return { text: "Runway under 6 months — urgent", sev: "error" };
  }
  const variance = Math.abs(Number(aud.revenue_variance_pct) || 0);
  if (variance > 15) {
    return { text: "Audited revenue diverges sharply from reported figures — review closely", sev: "warn" };
  }
  return null;
}

// ── Health scoring ───────────────────────────────────────────────────────────
export function computeHealth(analyses, submissions) {
  const bySection = {};
  for (const a of analyses) {
    if (!bySection[a.section]) bySection[a.section] = a.analysis;
  }

  const requiredRoles = roles.filter(r => r.required).map(r => r.key);
  const submittedRoles = new Set(submissions.map(s => s.role));
  let score = 100;
  const actions = [];

  const requiredDocs = DOCUMENT_SCHEMA.filter(d => d.required);
  for (const doc of requiredDocs) {
    if (!bySection[doc.section]) {
      score -= 12;
      actions.push({ sev: "error", icon: "📄", text: `${doc.label} not yet uploaded` });
    }
  }

  for (const roleKey of requiredRoles) {
    const role = getRole(roleKey);
    if (role?.needsDocs && !submittedRoles.has(roleKey)) {
      score -= 8;
      actions.push({ sev: "warn", icon: role.icon, text: `Awaiting: ${role.shortLabel || role.label}` });
    }
  }

  const needsRevision = submissions.filter(s => s.status === "needs_revision").length;
  if (needsRevision > 0) {
    score -= needsRevision * 5;
    actions.push({ sev: "warn", icon: "✏️", text: `${needsRevision} submission${needsRevision > 1 ? "s" : ""} need revision` });
  }

  score = Math.max(0, Math.min(100, score));
  if (actions.length === 0) {
    actions.push({ sev: "ok", icon: "✅", text: "All required documents and parties are in good standing" });
  }

  return { score, actions };
}

// ── Pack manifest ────────────────────────────────────────────────────────────
export const fundraisingPack = {
  id: "fundraising",
  name: "Fundraising",
  description: "Raising an investment round (term sheet through funding)",
  roles,
  stages,
  nextStage,
  advanceLabel,
  getDocumentSchema,
  getInlineFacts,
  getCompletenessIssues,
  factColors,
  aiUploadEndpoints,
  trackSections,
  computeHealth,
  getRole,
  getRoleLabel,
  outstandingItemsSections,
  intelligenceSections,
  getIntelligenceBadge,
  getIntelligenceHighlight,
  getSnapshotStats,
  getSnapshotFlag,
};

export default fundraisingPack;
