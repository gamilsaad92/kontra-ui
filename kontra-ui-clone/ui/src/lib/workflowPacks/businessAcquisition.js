// ── Business Acquisition workflow pack ──────────────────────────────────────
//
// This is the platform's proof-of-genericity pack: a completely different
// domain (buying a small/mid-size business instead of a commercial property)
// implemented purely as data — no changes to any panel or engine code. It
// declares its own participant roles, lifecycle stages, document schema, and
// health scoring logic, exactly like the CRE Acquisition pack does.
//
// Business Acquisition now uses the platform's universal AI extraction
// endpoint (POST /api/ai/analyze-document) for its two financial documents
// (Financial Statements, Quality of Earnings). Instead of a hand-tuned
// endpoint per doc type (like CRE Acquisition has), each schema entry below
// declares its own `aiExtraction` metadata — analyst persona, expected doc
// types, and the metrics to pull out — and the shared backend endpoint
// builds the AI prompt from that metadata at request time. Adding real AI
// extraction to a document in this pack (or any future pack) is therefore
// pure data: no new backend route required.

// ── Roles ────────────────────────────────────────────────────────────────────
// Read from shared/workflowRoles.json — see creAcquisition.js for why (single
// source of truth shared with the backend's pack-agnostic role labels).
import rolesConfig from "../../../../shared/workflowRoles.json";

export const roles = rolesConfig.business_acquisition.roles;

export function getRole(key) {
  return roles.find(r => r.key === key) || null;
}

export function getRoleLabel(key, { short = false } = {}) {
  const r = getRole(key);
  if (!r) return key;
  return short ? (r.shortLabel || r.label) : r.label;
}

// ── Lifecycle stages ─────────────────────────────────────────────────────────
// Stage keys + labels are read from shared/workflowStages.json — the same
// file the backend (api/index.js) validates against, so the backend's
// valid-stage list is now genuinely pack-driven. This pack happens to reuse
// the CRE Acquisition stage keys today with different labels (Due Diligence,
// Closed, etc); a future pack needing more/fewer stages only needs a new
// entry in that JSON file, not a backend code change. Icon/desc below are
// cosmetic UI-only metadata layered on by key.
import stagesConfig from "../../../../shared/workflowStages.json";

const STAGE_META = {
  uploading:    { icon: "📤" },
  under_review: { icon: "🔍" },
  approved:     { icon: "✅" },
  closing:      { icon: "✍️" },
  funded:       { icon: "🤝" },
};
const STAGE_DESC = {
  uploading:    "Parties submitting documents",
  under_review: "Buyer & advisors reviewing submissions",
  approved:     "Deal approved — finalizing",
  closing:      "Signing in process",
  funded:       "Deal closed",
};

export const stages = stagesConfig.business_acquisition.stages.map(s => ({
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
  under_review: "Mark as Approved",
  approved:     "Begin Closing",
  closing:      "Mark as Closed",
};

// ── Document schema ──────────────────────────────────────────────────────────
// A single checklist — Business Acquisition doesn't branch by sub-type yet
// (the way CRE branches by property type). The `dealSubtype` param is kept
// for interface parity with getDocumentSchema(propertyType) so panels can
// call either pack's function identically.
const DOCUMENT_SCHEMA = [
  { id: "loi",                 label: "Letter of Intent",           section: "loi",                 ai: false, required: true },
  { id: "purchase_agreement",  label: "Purchase Agreement",         section: "purchase_agreement",  ai: false, required: true },
  { id: "financials",          label: "Financial Statements (3-yr)",section: "financials",           ai: true,  required: true,
    aiExtraction: {
      analystRole: "M&A financial analyst reviewing a small/mid-size business acquisition",
      docTypes: ["Income Statement", "Balance Sheet", "Cash Flow Statement", "Financial Statements", "Other"],
      metrics: {
        revenue: "trailing twelve month gross revenue in dollars",
        ebitda: "EBITDA in dollars",
        sde: "seller's discretionary earnings (SDE) in dollars",
        net_margin: "net profit margin as a percentage 0-100",
        yoy_growth: "year-over-year revenue growth as a percentage",
      },
    } },
  { id: "tax_returns",         label: "Tax Returns (3-yr)",         section: "tax_returns",          ai: false, required: true },
  { id: "cap_table",           label: "Cap Table / Ownership",      section: "cap_table",            ai: false, required: true },
  { id: "qoe",                 label: "Quality of Earnings Report", section: "qoe",                  ai: true,  required: false,
    aiExtraction: {
      analystRole: "M&A due diligence accountant reviewing a quality of earnings (QoE) report",
      docTypes: ["Quality of Earnings Report", "Other"],
      metrics: {
        adjusted_ebitda: "adjusted EBITDA in dollars after QoE normalization adjustments",
        normalization_adjustments: "total dollar value of normalization/add-back adjustments identified",
        working_capital: "estimated normalized net working capital in dollars",
      },
    } },
  { id: "contracts",           label: "Material Contracts",         section: "contracts",            ai: false, required: false },
  { id: "disclosure_schedule", label: "Disclosure Schedule",        section: "disclosure_schedule",  ai: false, required: false },
];

const DOLLAR_METRIC_PATTERN = /revenue|ebitda|sde|capital|adjustments|income|expenses/i;

function humanizeMetricKey(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    .replace(/Sde/, "SDE").replace(/Yoy/, "YoY");
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
        : `${metrics[key]}${key.includes("margin") || key.includes("growth") ? "%" : ""}`,
      type: "neutral",
    }));
}

export function getCompletenessIssues(analysis, section) {
  if (!analysis || typeof analysis !== "object") return [];
  const issues = [];
  (analysis.risk_flags || []).forEach(flag => issues.push({ text: flag, sev: "Moderate" }));
  if (section === "financials" && analysis.metrics?.ebitda != null && Number(analysis.metrics.ebitda) < 0) {
    issues.push({ text: "Negative EBITDA reported — flag for deeper diligence", sev: "Critical" });
  }
  return issues;
}

export const factColors = {
  good: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  warn: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  neutral: { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
};

// ── Upload routing: financials and qoe now route through the platform's
// universal AI extraction endpoint (see docs above); everything else still
// uses the generic lightweight tracking endpoint. ──────────────────────────
export const aiUploadEndpoints = Object.fromEntries(
  DOCUMENT_SCHEMA.filter(d => d.ai).map(d => [d.section, "/api/ai/analyze-document"])
);
export const trackSections = new Set(DOCUMENT_SCHEMA.map(d => d.section));

// ── Outstanding Items grid — the CRE-specific risk/compliance/property
// panels (NOI, DSCR, occupancy) don't have a Business Acquisition equivalent
// and shouldn't get one — an M&A deal has no occupancy rate. This pack
// correctly declares none; the "Deal Intelligence" + "Financial Snapshot"
// dashboards below are its equivalent, built from the same AI-extracted
// financials/QoE data instead of CRE-only fields. ───────────────────────────
export const outstandingItemsSections = [];

// ── Dashboard: now that financials and QoE route through the universal AI
// extraction endpoint (see aiExtraction metadata above), this pack has real
// data to drive the same generic "Deal Intelligence" and "Financial
// Snapshot" panels the CRE pack uses — DealRoomPage needed zero changes. ────
export const intelligenceSections = [
  { key: "financials", icon: "📊", label: "Financials",        color: "#16a34a" },
  { key: "qoe",        icon: "🧮", label: "Quality of Earnings", color: "#2563eb" },
];

function marginBadge(margin) {
  if (margin == null) return null;
  const n = Number(margin);
  if (n >= 15) return { label: "Healthy Margin", color: "#16a34a" };
  if (n >= 5) return { label: "Moderate Margin", color: "#d97706" };
  return { label: "Thin Margin", color: "#dc2626" };
}

export function getIntelligenceBadge(section, analysis) {
  if (!analysis) return null;
  const metrics = analysis.metrics || {};
  if (section === "financials") return marginBadge(metrics.net_margin);
  if (section === "qoe") {
    const adj = Number(metrics.normalization_adjustments) || 0;
    const ebitda = Number(metrics.adjusted_ebitda) || 0;
    if (!ebitda) return null;
    const adjRatio = adj / ebitda;
    if (adjRatio > 0.3) return { label: "Large Adjustments", color: "#dc2626" };
    if (adjRatio > 0.1) return { label: "Some Adjustments", color: "#d97706" };
    return { label: "Clean Adjustments", color: "#16a34a" };
  }
  return null;
}

export function getIntelligenceHighlight(section, analysis) {
  if (!analysis) return null;
  const metrics = analysis.metrics || {};
  if (section === "financials" && metrics.revenue != null) {
    return `Revenue: $${Number(metrics.revenue).toLocaleString()}${metrics.ebitda != null ? ` · EBITDA: $${Number(metrics.ebitda).toLocaleString()}` : ""}`;
  }
  if (section === "qoe" && metrics.adjusted_ebitda != null) {
    return `Adjusted EBITDA: $${Number(metrics.adjusted_ebitda).toLocaleString()}${metrics.normalization_adjustments != null ? ` (+$${Number(metrics.normalization_adjustments).toLocaleString()} adj.)` : ""}`;
  }
  return null;
}

// ── Dashboard: Financial Snapshot rollup — key numbers already extracted by
// AI from the financial statements and QoE report, generic over whatever
// metrics each document's aiExtraction schema declares. ────────────────────
export function getSnapshotStats(bySection) {
  const fin = bySection.financials?.metrics || {};
  const qoe = bySection.qoe?.metrics || {};
  return [
    { label: "Revenue", value: fin.revenue != null ? `$${Number(fin.revenue).toLocaleString()}` : null },
    { label: "EBITDA", value: fin.ebitda != null ? `$${Number(fin.ebitda).toLocaleString()}` : null },
    { label: "SDE", value: fin.sde != null ? `$${Number(fin.sde).toLocaleString()}` : null },
    { label: "Net Margin", value: fin.net_margin != null ? `${fin.net_margin}%` : null },
    { label: "YoY Growth", value: fin.yoy_growth != null ? `${fin.yoy_growth}%` : null },
    { label: "Adjusted EBITDA", value: qoe.adjusted_ebitda != null ? `$${Number(qoe.adjusted_ebitda).toLocaleString()}` : null },
  ].filter(s => s.value);
}

export function getSnapshotFlag(bySection) {
  const fin = bySection.financials?.metrics || {};
  const qoe = bySection.qoe?.metrics || {};
  if (fin.ebitda != null && Number(fin.ebitda) < 0) {
    return { text: "Negative EBITDA reported", sev: "error" };
  }
  const ebitda = Number(qoe.adjusted_ebitda) || 0;
  const adj = Number(qoe.normalization_adjustments) || 0;
  if (ebitda && adj / ebitda > 0.3) {
    return { text: "QoE normalization adjustments unusually large — review closely", sev: "warn" };
  }
  return null;
}

// ── Health scoring ───────────────────────────────────────────────────────────
// No domain-specific parsing (no DSCR/occupancy equivalents yet) — health is
// simply: are the required documents in, and are the required parties in.
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
export const businessAcquisitionPack = {
  id: "business_acquisition",
  name: "Business Acquisition",
  description: "Buying or selling a company (LOI through closing)",
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

export default businessAcquisitionPack;
