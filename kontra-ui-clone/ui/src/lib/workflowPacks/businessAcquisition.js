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
export const roles = [
  { key: "buyer",   label: "Buyer",              icon: "💼", required: true,  needsDocs: false, invitable: false, canManage: true },
  { key: "seller",  label: "Seller",              icon: "🏪", required: true,  needsDocs: true,  invitable: true, inviteAction: "provide financial statements and disclosures" },
  { key: "cpa",     label: "CPA / Accountant",    shortLabel: "CPA", icon: "🧮", required: true,  needsDocs: true,  invitable: true, inviteAction: "review the quality of earnings report" },
  { key: "counsel", label: "Legal Counsel",       icon: "⚖️", required: true,  needsDocs: true,  invitable: true, inviteAction: "review the purchase agreement" },
  { key: "lender",  label: "Lender",              icon: "🏦", required: false, needsDocs: false, invitable: true, inviteAction: "review the financing package" },
  { key: "broker",  label: "M&A Broker",          icon: "🤝", required: false, needsDocs: false, invitable: true, inviteAction: "coordinate the transaction" },
];

export function getRole(key) {
  return roles.find(r => r.key === key) || null;
}

export function getRoleLabel(key, { short = false } = {}) {
  const r = getRole(key);
  if (!r) return key;
  return short ? (r.shortLabel || r.label) : r.label;
}

// ── Lifecycle stages ─────────────────────────────────────────────────────────
// Stage *keys* intentionally match the CRE Acquisition pack (uploading →
// under_review → approved → closing → funded) — the backend coordination API
// (advance/status endpoints) validates against a fixed set of stage keys that
// isn't yet pack-aware, so packs share the same keys today and differentiate
// only via label/icon/desc. Making the backend's valid-stage list itself
// pack-driven is a later sprint if/when a pack needs genuinely different
// lifecycle shapes (e.g. more/fewer stages).
export const stages = [
  { key: "uploading",    label: "Due Diligence", icon: "📤", desc: "Parties submitting documents" },
  { key: "under_review", label: "Under Review",  icon: "🔍", desc: "Buyer & advisors reviewing submissions" },
  { key: "approved",     label: "Approved",      icon: "✅", desc: "Deal approved — finalizing" },
  { key: "closing",      label: "Closing",       icon: "✍️", desc: "Signing in process" },
  { key: "funded",       label: "Closed",        icon: "🤝", desc: "Deal closed" },
];

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

// ── Outstanding Items grid — Business Acquisition doesn't have a risk score,
// compliance rollup, or property-details equivalent yet, so none of the
// three panels apply. DealRoomPage reads this straight from the pack. ──────
export const outstandingItemsSections = [];

// ── Dashboard: no deep AI extraction yet, so no intelligence sections and no
// snapshot stats — DealRoomPage reads these straight from the pack, so once
// this pack gets real AI review these dashboards will start rendering with
// zero changes to DealRoomPage itself. ──────────────────────────────────────
export const intelligenceSections = [];
export function getIntelligenceBadge(_section, _analysis) { return null; }
export function getIntelligenceHighlight(_section, _analysis) { return null; }
export function getSnapshotStats(_bySection) { return []; }
export function getSnapshotFlag(_bySection) { return null; }

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
