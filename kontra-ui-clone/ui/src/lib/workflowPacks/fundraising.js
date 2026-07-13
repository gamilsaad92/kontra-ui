// ── Fundraising workflow pack ────────────────────────────────────────────────
//
// The platform's third pack, proving the engine generalizes beyond "buying
// something" (CRE Acquisition, Business Acquisition) to "raising capital" —
// a different transaction shape (a round, not a purchase) with its own
// roles (founder/investor/counsel/auditor/banker instead of
// owner/lender/buyer/seller) and documents (term sheet, cap table, SAFE/SPA
// instead of purchase agreements).
//
// Built on genericPackFactory — the same generic health scoring / AI-fact
// extraction machinery Business Acquisition uses, with only the
// domain-specific dashboard judgement (runway badge, snapshot ordering)
// layered on top as overrides.

import rolesConfig from "../../../../shared/workflowRoles.json";
import stagesConfig from "../../../../shared/workflowStages.json";
import { createGenericPack } from "./genericPackFactory";

export const roles = rolesConfig.fundraising.roles;

// ── Lifecycle stages ─────────────────────────────────────────────────────────
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

export const advanceLabel = {
  uploading:    "Move to Under Review",
  under_review: "Mark Term Sheet Signed",
  approved:     "Begin Closing",
  closing:      "Mark as Funded",
};

// ── Document schema ──────────────────────────────────────────────────────────
// assignedTo: which role is responsible for uploading this document.
// founder: core company materials (financials, cap table, term sheet)
// auditor: audited financials
// counsel: legal agreements
const DOCUMENT_SCHEMA = [
  { id: "term_sheet",         label: "Term Sheet",                section: "term_sheet",         ai: false, required: true,  assignedTo: ["founder"] },
  { id: "cap_table",          label: "Cap Table / Ownership",      section: "cap_table",          ai: false, required: true,  assignedTo: ["founder"] },
  { id: "financials",         label: "Financial Statements",       section: "financials",         ai: true,  required: true,  assignedTo: ["founder"],
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
  { id: "audited_financials", label: "Audited Financials",         section: "audited_financials", ai: true,  required: false, assignedTo: ["auditor"],
    aiExtraction: {
      analystRole: "independent auditor reviewing audited financial statements for an investment round",
      docTypes: ["Audit Report", "Audited Financial Statements", "Other"],
      metrics: {
        audited_revenue: "audited trailing twelve month revenue in dollars",
        revenue_variance_pct: "percentage variance between audited and previously reported revenue",
        material_weaknesses: "number of material weaknesses or significant deficiencies identified",
      },
    } },
  { id: "spa",                 label: "Stock Purchase Agreement / SAFE", section: "spa",                 ai: false, required: true,  assignedTo: ["counsel"] },
  { id: "disclosure_schedule", label: "Disclosure Schedule",       section: "disclosure_schedule", ai: false, required: false, assignedTo: ["founder"] },
];

function humanizeMetricKey(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    .replace(/Mrr/, "MRR").replace(/Arr/, "ARR").replace(/Yoy/, "YoY").replace(/Pct/, "%");
}

function getExtraCompletenessIssues(analysis, section) {
  if (section === "financials" && analysis.metrics?.runway_months != null && Number(analysis.metrics.runway_months) < 6) {
    return [{ text: "Less than 6 months of runway remaining — flag for urgent diligence", sev: "Critical" }];
  }
  return [];
}

const intelligenceSections = [
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

function getIntelligenceBadge(section, analysis) {
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

function getIntelligenceHighlight(section, analysis) {
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

function getSnapshotStats(bySection) {
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

function getSnapshotFlag(bySection) {
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

export const onboardingSteps = [
  { icon: "📈", title: "Upload financial statements", desc: "MRR, burn rate, runway — AI structures them automatically" },
  { icon: "🧾", title: "Request audited financials", desc: "Send the auditor link above; their report goes directly into the room" },
  { icon: "📝", title: "Add the term sheet & cap table", desc: "AI tracks ownership changes and flags terms investors should review" },
];

export const fundraisingPack = createGenericPack({
  id: "fundraising",
  name: "Fundraising",
  description: "Raising an investment round (term sheet through funding)",
  checklistTitle: "Fundraising Checklist",
  onboardingSteps,
  roles,
  stages,
  advanceLabel,
  documentSchema: DOCUMENT_SCHEMA,
  humanizeMetricKey,
  dollarMetricPattern: /revenue|mrr|arr|burn|capital|adjustments/i,
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
} = fundraisingPack;

export default fundraisingPack;
