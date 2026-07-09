// ── Business Acquisition workflow pack ──────────────────────────────────────
//
// This is the platform's proof-of-genericity pack: a completely different
// domain (buying a small/mid-size business instead of a commercial property)
// implemented purely as data — no changes to any panel or engine code. It
// declares its own participant roles, lifecycle stages, document schema, and
// health scoring logic, exactly like the CRE Acquisition pack does.
//
// Built on genericPackFactory — the same generic health scoring / AI-fact
// extraction machinery Fundraising uses, with only the domain-specific
// dashboard judgement (margin badge, snapshot ordering) layered on top as
// overrides.

import rolesConfig from "../../../../shared/workflowRoles.json";
import stagesConfig from "../../../../shared/workflowStages.json";
import { createGenericPack } from "./genericPackFactory";

export const roles = rolesConfig.business_acquisition.roles;

// ── Lifecycle stages ─────────────────────────────────────────────────────────
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

export const advanceLabel = {
  uploading:    "Move to Under Review",
  under_review: "Mark as Approved",
  approved:     "Begin Closing",
  closing:      "Mark as Closed",
};

// ── Document schema ──────────────────────────────────────────────────────────
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

function humanizeMetricKey(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    .replace(/Sde/, "SDE").replace(/Yoy/, "YoY");
}

function getExtraCompletenessIssues(analysis, section) {
  if (section === "financials" && analysis.metrics?.ebitda != null && Number(analysis.metrics.ebitda) < 0) {
    return [{ text: "Negative EBITDA reported — flag for deeper diligence", sev: "Critical" }];
  }
  return [];
}

const intelligenceSections = [
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

function getIntelligenceBadge(section, analysis) {
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

function getIntelligenceHighlight(section, analysis) {
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

function getSnapshotStats(bySection) {
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

function getSnapshotFlag(bySection) {
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

export const businessAcquisitionPack = createGenericPack({
  id: "business_acquisition",
  name: "Business Acquisition",
  description: "Buying or selling a company (LOI through closing)",
  checklistTitle: "Due Diligence Checklist",
  roles,
  stages,
  advanceLabel,
  documentSchema: DOCUMENT_SCHEMA,
  humanizeMetricKey,
  dollarMetricPattern: /revenue|ebitda|sde|capital|adjustments|income|expenses/i,
  getExtraCompletenessIssues,
  intelligenceSections,
  getIntelligenceBadge,
  getIntelligenceHighlight,
  getSnapshotStats,
  getSnapshotFlag,
});

export const {
  nextStage,
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
} = businessAcquisitionPack;

export default businessAcquisitionPack;
