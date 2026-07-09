// ── CRE Acquisition workflow template ───────────────────────────────────────
//
// This is the platform's first workflow template: it declares everything that
// makes a "CRE Acquisition" data room what it is — its participant roles, its
// lifecycle stages, its per-property-type document schema (with extraction
// rules for turning raw AI analysis into inline facts/issues), and the health
// scoring logic that turns the current state into a risk score + action list.
//
// The generic panels (DocumentChecklistPanel, DealHealthPanel,
// DealCoordinationPanel, InvitePanel) read everything from a template object
// like this one instead of hardcoding CRE concepts — this file is the
// implementation of the template, they are the engine that executes it.

// ── Roles ────────────────────────────────────────────────────────────────────
// Role keys, labels, icons, colors, and invite-page copy are read from
// shared/workflowRoles.json — the same file the backend (api/index.js) reads
// for pack-agnostic email/notification/event-log role labels. This is the
// same "single source of truth" pattern as stages (see workflowStages.json):
// adding or editing a role only requires editing that JSON, never this file
// or the backend, and role keys can safely mean different things across
// packs (e.g. "lender" here vs in businessAcquisition.js) since consumers
// always look roles up scoped to the active pack, not from a flat dict.
import rolesConfig from "../../../../shared/workflowRoles.json";

export const roles = rolesConfig.cre_acquisition.roles;

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
// file the backend (api/index.js) validates against. Icon/desc are cosmetic
// UI-only metadata layered on top by key, so they can't drift the two ends
// out of sync. Adding a pack with different stage keys only requires editing
// that JSON file, not this file or the backend.
import stagesConfig from "../../../../shared/workflowStages.json";

const STAGE_META = {
  uploading:    { icon: "📤", desc: "Parties submitting documents" },
  under_review: { icon: "🔍", desc: "Lender reviewing submissions" },
  approved:     { icon: "✅", desc: "Deal approved — finalizing" },
  closing:      { icon: "✍️", desc: "Signing & funding in process" },
  funded:       { icon: "🏦", desc: "Deal closed and funded" },
};

export const stages = stagesConfig.cre_acquisition.stages.map(s => ({
  ...s,
  ...(STAGE_META[s.key] || {}),
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
  closing:      "Mark as Funded",
};

// ── Document schema per property type ───────────────────────────────────────
// Each item declares: id/section (checklist key), label, whether AI reviews
// it, and whether it's required for the checklist to be considered complete.
const documentSchemas = {
  Multifamily: [
    { id: "purchase_agreement", label: "Purchase Agreement",            section: "purchase_agreement", ai: true,  required: true },
    { id: "rent_roll",          label: "Rent Roll",                     section: "rent_roll",          ai: true,  required: true },
    { id: "financials",         label: "T-12 Financial Statement",      section: "financials",         ai: true,  required: true },
    { id: "insurance",          label: "Insurance Certificate",         section: "insurance",          ai: true,  required: true },
    { id: "inspection",         label: "Property Inspection Report",    section: "inspection",         ai: true,  required: true },
    { id: "estoppel",           label: "Estoppel Certificates",         section: "estoppel",           ai: true,  required: false },
    { id: "environmental",      label: "Environmental Report (Phase I)",section: "environmental",      ai: true,  required: true },
    { id: "survey",             label: "Survey / ALTA",                 section: "survey",             ai: true,  required: false },
    { id: "title",              label: "Title Commitment",              section: "title",              ai: true,  required: true },
  ],
  Office: [
    { id: "purchase_agreement", label: "Purchase Agreement",            section: "purchase_agreement", ai: true,  required: true },
    { id: "rent_roll",          label: "Rent Roll",                     section: "rent_roll",          ai: true,  required: true },
    { id: "financials",         label: "T-12 Financial Statement",      section: "financials",         ai: true,  required: true },
    { id: "insurance",          label: "Insurance Certificate",         section: "insurance",          ai: true,  required: true },
    { id: "inspection",         label: "Property Inspection Report",    section: "inspection",         ai: true,  required: true },
    { id: "estoppel",           label: "Estoppel / Lease Abstracts",    section: "estoppel",           ai: true,  required: true },
    { id: "environmental",      label: "Environmental Report (Phase I)",section: "environmental",      ai: true,  required: true },
    { id: "survey",             label: "Survey / ALTA",                 section: "survey",             ai: true,  required: false },
    { id: "title",              label: "Title Commitment",              section: "title",              ai: true,  required: true },
    { id: "legal",              label: "Loan / Legal Documents",        section: "legal",              ai: true,  required: false },
  ],
  Industrial: [
    { id: "purchase_agreement", label: "Purchase Agreement",            section: "purchase_agreement", ai: true,  required: true },
    { id: "financials",         label: "Financial Statement",           section: "financials",         ai: true,  required: true },
    { id: "insurance",          label: "Insurance Certificate",         section: "insurance",          ai: true,  required: true },
    { id: "inspection",         label: "Property Inspection Report",    section: "inspection",         ai: true,  required: true },
    { id: "environmental",      label: "Environmental Report (Phase I)",section: "environmental",      ai: true,  required: true },
    { id: "survey",             label: "Survey / ALTA",                 section: "survey",             ai: true,  required: false },
    { id: "title",              label: "Title Commitment",              section: "title",              ai: true,  required: true },
    { id: "legal",              label: "Lease / Legal Documents",       section: "legal",              ai: true,  required: false },
  ],
  Hotel: [
    { id: "purchase_agreement", label: "Purchase Agreement",            section: "purchase_agreement", ai: true,  required: true },
    { id: "brand_standards",    label: "PIP / Brand Standards",         section: "brand-standards",    ai: true,  required: true },
    { id: "legal",              label: "Franchise Agreement",           section: "legal",              ai: true,  required: true },
    { id: "financials",         label: "STR / P&L Statement",           section: "financials",         ai: true,  required: true },
    { id: "insurance",          label: "Insurance Certificate",         section: "insurance",          ai: true,  required: true },
    { id: "inspection",         label: "Property Inspection Report",    section: "inspection",         ai: true,  required: true },
    { id: "environmental",      label: "Environmental Report (Phase I)",section: "environmental",      ai: true,  required: true },
    { id: "survey",             label: "Survey / ALTA",                 section: "survey",             ai: true,  required: false },
    { id: "title",              label: "Title Commitment",              section: "title",              ai: true,  required: true },
  ],
  Retail: [
    { id: "purchase_agreement", label: "Purchase Agreement",            section: "purchase_agreement", ai: true,  required: true },
    { id: "rent_roll",          label: "Rent Roll",                     section: "rent_roll",          ai: true,  required: true },
    { id: "financials",         label: "T-12 Financial Statement",      section: "financials",         ai: true,  required: true },
    { id: "insurance",          label: "Insurance Certificate",         section: "insurance",          ai: true,  required: true },
    { id: "inspection",         label: "Property Inspection Report",    section: "inspection",         ai: true,  required: true },
    { id: "estoppel",           label: "Estoppel / Lease Abstracts",    section: "estoppel",           ai: true,  required: true },
    { id: "environmental",      label: "Environmental Report (Phase I)",section: "environmental",      ai: true,  required: true },
    { id: "survey",             label: "Survey / ALTA",                 section: "survey",             ai: true,  required: false },
    { id: "title",              label: "Title Commitment",              section: "title",              ai: true,  required: true },
  ],
};

const DEFAULT_DOCUMENT_SCHEMA = documentSchemas.Multifamily;

export function getDocumentSchema(propertyType) {
  if (!propertyType) return DEFAULT_DOCUMENT_SCHEMA;
  const t = propertyType.toLowerCase();
  if (t.includes("hotel") || t.includes("hospitality") || t.includes("motel")) return documentSchemas.Hotel;
  if (t.includes("office")) return documentSchemas.Office;
  if (t.includes("industrial") || t.includes("warehouse")) return documentSchemas.Industrial;
  if (t.includes("retail") || t.includes("strip") || t.includes("shopping")) return documentSchemas.Retail;
  return documentSchemas.Multifamily;
}

// ── Extraction rules: inline key facts per section ──────────────────────────
export function getInlineFacts(analysis, section) {
  if (!analysis || typeof analysis !== "object" || analysis.pending) return [];
  const facts = [];

  if (section === "financials") {
    if (analysis.noi) facts.push({ label: "NOI", value: analysis.noi, type: "good" });
    if (analysis.occupancy) facts.push({ label: "Occupancy", value: analysis.occupancy, type: "good" });
    if (analysis.dscr) facts.push({ label: "DSCR", value: analysis.dscr, type: "neutral" });
    if (analysis.revpar) facts.push({ label: "RevPAR", value: analysis.revpar, type: "neutral" });
    if (analysis.covenantStatus && analysis.covenantStatus !== "Compliant" && analysis.covenantStatus !== "Unknown")
      facts.push({ label: "Covenant", value: analysis.covenantStatus, type: "warn" });
  }

  if (section === "insurance") {
    if (analysis.coverageAmount) facts.push({ label: "Coverage", value: analysis.coverageAmount, type: "good" });
    if (analysis.expirationDate) {
      const days = analysis.expiresInDays;
      facts.push({
        label: "Expires",
        value: days != null ? `${analysis.expirationDate} (${days}d)` : analysis.expirationDate,
        type: days != null && days < 45 ? "warn" : "neutral",
      });
    }
    if (analysis.complianceStatus && analysis.complianceStatus !== "Compliant")
      facts.push({ label: "Status", value: analysis.complianceStatus, type: "warn" });
  }

  if (section === "inspection") {
    if (analysis.overallCondition) facts.push({ label: "Condition", value: analysis.overallCondition, type: analysis.overallCondition === "Good" ? "good" : analysis.overallCondition === "Poor" ? "warn" : "neutral" });
    if (analysis.totalDeferredCost) facts.push({ label: "Deferred Maint.", value: analysis.totalDeferredCost, type: "neutral" });
    if (analysis.lifeSafetyFindings?.length) facts.push({ label: "Life Safety", value: `${analysis.lifeSafetyFindings.length} item${analysis.lifeSafetyFindings.length > 1 ? "s" : ""}`, type: "warn" });
  }

  if (section === "legal") {
    if (analysis.documentType) facts.push({ label: "Type", value: analysis.documentType, type: "neutral" });
    if (analysis.complianceStatus && analysis.complianceStatus !== "Clear")
      facts.push({ label: "Status", value: analysis.complianceStatus, type: "warn" });
    if (analysis.redFlags?.length)
      facts.push({ label: "Red Flags", value: `${analysis.redFlags.length} found`, type: "warn" });
  }

  if (section === "brand-standards") {
    if (analysis.brandName) facts.push({ label: "Brand", value: analysis.brandName, type: "neutral" });
    if (analysis.totalEstimatedPIPCost) facts.push({ label: "PIP Cost", value: analysis.totalEstimatedPIPCost, type: "warn" });
    if (analysis.complianceDeadline) facts.push({ label: "Deadline", value: analysis.complianceDeadline, type: "warn" });
  }

  if (section === "purchase_agreement") {
    if (analysis.purchasePrice) facts.push({ label: "Price", value: analysis.purchasePrice, type: "good" });
    if (analysis.closingDate) facts.push({ label: "Closing", value: analysis.closingDate, type: "neutral" });
    if (analysis.earnestMoney) facts.push({ label: "Earnest $", value: analysis.earnestMoney, type: "neutral" });
    if (analysis.dueDiligencePeriod) facts.push({ label: "DD Period", value: analysis.dueDiligencePeriod, type: "neutral" });
    if (analysis.redFlags?.length) facts.push({ label: "Red Flags", value: `${analysis.redFlags.length} found`, type: "warn" });
  }

  if (section === "rent_roll") {
    if (analysis.occupancyRate) facts.push({ label: "Occupancy", value: analysis.occupancyRate, type: "good" });
    if (analysis.totalMonthlyRent) facts.push({ label: "Monthly Rent", value: analysis.totalMonthlyRent, type: "good" });
    if (analysis.belowMarketUnits) facts.push({ label: "Below-Market", value: `${analysis.belowMarketUnits} units`, type: "warn" });
    if (analysis.covenantStatus && analysis.covenantStatus !== "Compliant" && analysis.covenantStatus !== "Unknown")
      facts.push({ label: "Covenant", value: analysis.covenantStatus, type: "warn" });
  }

  if (section === "title") {
    if (analysis.titleCompany) facts.push({ label: "Title Co.", value: analysis.titleCompany, type: "neutral" });
    const exceptions = analysis.scheduleBExceptions?.length || 0;
    if (exceptions > 0) facts.push({ label: "Schedule B", value: `${exceptions} exception${exceptions > 1 ? "s" : ""}`, type: exceptions > 2 ? "warn" : "neutral" });
    if (analysis.clearToClose === false) facts.push({ label: "Clear to Close", value: "Issues found", type: "warn" });
    else if (analysis.clearToClose === true) facts.push({ label: "Clear to Close", value: "Yes", type: "good" });
  }

  if (section === "environmental") {
    const recs = analysis.recognizedEnvironmentalConditions?.length || 0;
    if (recs > 0) facts.push({ label: "RECs", value: `${recs} found`, type: "warn" });
    else if (recs === 0 && analysis.confidence > 30) facts.push({ label: "RECs", value: "None found", type: "good" });
    if (analysis.furtherActionRequired === true) facts.push({ label: "Phase II", value: "Recommended", type: "warn" });
    else if (analysis.furtherActionRequired === false) facts.push({ label: "Phase II", value: "Not required", type: "good" });
  }

  if (section === "survey") {
    if (analysis.lotSize) facts.push({ label: "Lot Size", value: analysis.lotSize, type: "neutral" });
    if (analysis.zoning) facts.push({ label: "Zoning", value: analysis.zoning, type: "neutral" });
    if (analysis.encroachments?.length) facts.push({ label: "Encroachments", value: `${analysis.encroachments.length} noted`, type: "warn" });
  }

  if (section === "estoppel") {
    if (analysis.tenantName) facts.push({ label: "Tenant", value: analysis.tenantName, type: "neutral" });
    if (analysis.leaseEndDate) facts.push({ label: "Lease End", value: analysis.leaseEndDate, type: "neutral" });
    if (analysis.monthlyRent) facts.push({ label: "Rent", value: analysis.monthlyRent, type: "good" });
    if (analysis.disputes === true) facts.push({ label: "Disputes", value: "Claimed", type: "warn" });
    if (analysis.redFlags?.length) facts.push({ label: "Red Flags", value: `${analysis.redFlags.length} found`, type: "warn" });
  }

  return facts.slice(0, 4);
}

// ── Extraction rules: completeness issues per section ───────────────────────
export function getCompletenessIssues(analysis, section) {
  if (!analysis || typeof analysis !== "object") return [];
  const issues = [];

  if (section === "insurance") {
    (analysis.coverageGaps || [])
      .filter(g => ["Critical", "Moderate"].includes(g.severity))
      .forEach(g => issues.push({ text: g.gap, sev: g.severity }));
    if (analysis.complianceStatus === "Action Needed")
      issues.push({ text: "Policy compliance action required", sev: "Critical" });
    if (analysis.expiresInDays != null && analysis.expiresInDays < 30)
      issues.push({ text: `Policy expires in ${analysis.expiresInDays} days — renew immediately`, sev: "Critical" });
    else if (analysis.expiresInDays != null && analysis.expiresInDays < 60)
      issues.push({ text: `Policy expires in ${analysis.expiresInDays} days`, sev: "Moderate" });
  }
  if (section === "inspection") {
    (analysis.lifeSafetyFindings || [])
      .forEach(f => issues.push({ text: `Life safety: ${f.item}`, sev: f.severity || "Critical" }));
    if (analysis.overallCondition === "Poor")
      issues.push({ text: "Overall condition rated Poor — lender review required", sev: "Critical" });
  }
  if (section === "legal") {
    (analysis.redFlags || [])
      .filter(f => ["Critical", "Moderate"].includes(f.severity))
      .forEach(f => issues.push({ text: f.issue, sev: f.severity }));
    if (analysis.complianceStatus === "Issues Found")
      issues.push({ text: "Legal compliance issues found — attorney review needed", sev: "Critical" });
  }
  if (section === "financials") {
    (analysis.anomalies || [])
      .filter(a => a.severity === "High")
      .forEach(a => issues.push({ text: a.description, sev: "Critical" }));
    if (analysis.covenantStatus === "Breached")
      issues.push({ text: "Loan covenant breached — lender notification required", sev: "Critical" });
    else if (analysis.covenantStatus === "At Risk")
      issues.push({ text: "Covenant at risk — monitor before close", sev: "Moderate" });
  }
  if (section === "brand-standards") {
    (analysis.redFlags || [])
      .filter(f => f.severity === "Critical")
      .forEach(f => issues.push({ text: f.issue, sev: "Critical" }));
    if (analysis.totalEstimatedPIPCost)
      issues.push({ text: `PIP cost estimate: ${analysis.totalEstimatedPIPCost}`, sev: "Moderate" });
  }
  if (section === "title") {
    (analysis.scheduleBExceptions || [])
      .filter(e => e.severity === "Critical")
      .forEach(e => issues.push({ text: `Schedule B: ${e.item}`, sev: "Critical" }));
    if (analysis.clearToClose === false)
      issues.push({ text: "Title not clear to close — review required", sev: "Critical" });
    (analysis.liens || []).slice(0, 2).forEach(l => issues.push({ text: `Lien: ${l}`, sev: "Moderate" }));
  }
  if (section === "environmental") {
    (analysis.recognizedEnvironmentalConditions || [])
      .filter(r => r.severity === "Critical")
      .forEach(r => issues.push({ text: `REC: ${r.item}`, sev: "Critical" }));
    if (analysis.furtherActionRequired === true)
      issues.push({ text: "Phase II ESA recommended before closing", sev: "Moderate" });
  }
  if (section === "purchase_agreement") {
    (analysis.redFlags || [])
      .filter(f => f.severity === "Critical")
      .forEach(f => issues.push({ text: f.issue, sev: "Critical" }));
  }
  if (section === "rent_roll") {
    (analysis.anomalies || [])
      .filter(a => a.severity === "High")
      .forEach(a => issues.push({ text: a.description, sev: "Critical" }));
    if (analysis.covenantStatus === "Breached")
      issues.push({ text: "Occupancy covenant breached", sev: "Critical" });
  }
  if (section === "estoppel") {
    if (analysis.disputes === true)
      issues.push({ text: "Tenant disputes lease terms — verify with landlord", sev: "Critical" });
    (analysis.redFlags || [])
      .filter(f => f.severity === "Critical")
      .forEach(f => issues.push({ text: f.issue, sev: "Critical" }));
  }
  return issues;
}

export const factColors = {
  good: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  warn: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  neutral: { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
};

// ── Outstanding Items grid — which of the risk/compliance/property panels
// this pack supports. DealRoomPage intersects this with the role's requested
// sections (from shared/workflowRoles.json, via pack.getRole()) so a pack
// only needs to list what it actually has; no per-widget "is this the CRE
// pack?" check is needed anywhere else. ──────────────────────────────────────
export const outstandingItemsSections = ["risk", "compliance", "property"];

// ── Dashboard: which sections get their own "Deal Intelligence" card, and
// how to badge/highlight each one. Business Acquisition has none of this yet
// (no deep AI extraction), so its dashboard cards simply won't render —
// DealRoomPage reads this straight from the pack instead of hardcoding CRE. ──
export const intelligenceSections = [
  { key: "inspection", icon: "🔍", label: "Inspection",  color: "#d97706" },
  { key: "insurance",  icon: "🛡️", label: "Insurance",   color: "#2563eb" },
  { key: "financials", icon: "📊", label: "Financials",  color: "#16a34a" },
];

export function getIntelligenceBadge(section, analysis) {
  if (section === "inspection")  return { label: analysis.overallCondition, color: analysis.overallCondition === "Good" ? "#16a34a" : analysis.overallCondition === "Fair" ? "#d97706" : "#dc2626" };
  if (section === "insurance")   return { label: analysis.complianceStatus, color: analysis.complianceStatus === "Compliant" ? "#16a34a" : "#d97706" };
  if (section === "financials")  return { label: analysis.covenantStatus, color: analysis.covenantStatus === "Compliant" ? "#16a34a" : analysis.covenantStatus === "At Risk" ? "#d97706" : analysis.covenantStatus === "Breached" ? "#dc2626" : "#6b7280" };
  return null;
}

export function getIntelligenceHighlight(section, analysis) {
  if (section === "inspection")  return analysis.totalDeferredCost ? `Deferred maintenance: ${analysis.totalDeferredCost}` : null;
  if (section === "insurance")   return analysis.expirationDate ? `Expires: ${analysis.expirationDate}${analysis.expiresInDays != null ? ` (${analysis.expiresInDays} days)` : ""}` : null;
  if (section === "financials")  return analysis.noi ? `NOI: ${analysis.noi}${analysis.dscr ? ` · DSCR: ${analysis.dscr}` : ""}` : null;
  return null;
}

// ── Dashboard: Financial Summary rollup — key numbers already extracted by
// AI from the purchase agreement, rent roll, and financial statements. ──────
export function getSnapshotStats(bySection) {
  const fin = bySection.financials;
  const pa = bySection.purchase_agreement;
  const rr = bySection.rent_roll;
  return [
    { label: "Purchase Price", value: pa?.purchasePrice },
    { label: "NOI", value: fin?.noi },
    { label: "DSCR", value: fin?.dscr },
    { label: "Occupancy", value: fin?.occupancy || rr?.occupancyRate },
    { label: "Monthly Rent", value: rr?.totalMonthlyRent },
    { label: "Cap Rate", value: fin?.capRate },
  ].filter(s => s.value);
}

export function getSnapshotFlag(bySection) {
  const fin = bySection.financials;
  if (fin?.covenantStatus === "Breached") return { text: "Loan covenant breached", sev: "error" };
  if (fin?.covenantStatus === "At Risk") return { text: "Loan covenant at risk", sev: "warn" };
  return null;
}

// ── Upload routing: which sections get deep AI analysis vs. lightweight tracking ──
export const aiUploadEndpoints = {
  inspection: "/api/ai/analyze-inspection",
  insurance: "/api/ai/review-insurance",
  financials: "/api/ai/review-financials",
  legal: "/api/ai/review-legal",
  "brand-standards": "/api/ai/review-brand-standards",
};
export const trackSections = new Set(["purchase_agreement", "rent_roll", "estoppel", "environmental", "survey", "title"]);

// ── AI recommended next actions (a.k.a. "Deal Health") ──────────────────────
// Reads the template's own roles + document schema rules to score the deal
// and produce a plain-English action list — no other module needs to know
// what "DSCR" or "life safety findings" mean.
function parseDSCR(dscr) {
  if (!dscr) return null;
  const n = parseFloat(String(dscr).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

function parseDays(val) {
  if (val == null) return null;
  const n = parseInt(String(val));
  return isNaN(n) ? null : n;
}

export function computeHealth(analyses, submissions) {
  const bySection = {};
  for (const a of analyses) {
    if (!bySection[a.section]) bySection[a.section] = a.analysis;
  }

  const requiredRoles = roles.filter(r => r.required).map(r => r.key);
  const submittedRoles = new Set(submissions.map(s => s.role));
  let score = 100;
  const actions = [];

  // ── Inspection ──────────────────────────────────────────────────────────
  const insp = bySection["inspection"];
  if (!insp) {
    score -= 20;
    actions.push({ sev: "error", icon: "🔍", text: "Inspection report not yet uploaded" });
  } else {
    if (insp.overallCondition === "Poor") {
      score -= 15;
      actions.push({ sev: "error", icon: "🔍", text: "Inspection: Poor condition — action required" });
    } else if (insp.overallCondition === "Fair") {
      score -= 5;
      actions.push({ sev: "warn", icon: "🔍", text: "Inspection condition rated Fair — review findings" });
    }
    if (insp.lifeSafetyFindings?.length > 0) {
      score -= 10;
      actions.push({ sev: "error", icon: "🚨", text: `${insp.lifeSafetyFindings.length} life-safety finding(s) require immediate attention` });
    }
    if (insp.totalDeferredCost) {
      score -= 3;
      actions.push({ sev: "warn", icon: "🔧", text: `Deferred maintenance estimated at ${insp.totalDeferredCost}` });
    }
  }

  // ── Insurance ────────────────────────────────────────────────────────────
  const ins = bySection["insurance"];
  if (!ins) {
    score -= 15;
    actions.push({ sev: "error", icon: "🛡️", text: "Insurance certificate not yet uploaded" });
  } else {
    if (ins.complianceStatus === "Non-Compliant") {
      score -= 15;
      actions.push({ sev: "error", icon: "🛡️", text: "Insurance is non-compliant — coverage gaps must be addressed" });
    }
    const days = parseDays(ins.expiresInDays);
    if (days != null && days < 30) {
      score -= 10;
      actions.push({ sev: "error", icon: "📅", text: `Insurance expires in ${days} day${days === 1 ? "" : "s"} — renewal urgent` });
    } else if (days != null && days < 60) {
      score -= 5;
      actions.push({ sev: "warn", icon: "📅", text: `Insurance expires in ${days} days — schedule renewal` });
    }
    if (ins.coverageGaps?.length > 0) {
      score -= 3;
      actions.push({ sev: "warn", icon: "🛡️", text: `${ins.coverageGaps.length} coverage gap(s) identified` });
    }
  }

  // ── Financials ───────────────────────────────────────────────────────────
  const fin = bySection["financials"];
  if (!fin) {
    score -= 15;
    actions.push({ sev: "error", icon: "📊", text: "Financial statements not yet uploaded" });
  } else {
    const dscr = parseDSCR(fin.dscr);
    if (dscr != null && dscr < 1.0) {
      score -= 20;
      actions.push({ sev: "error", icon: "📊", text: `DSCR critically low: ${fin.dscr} — lender minimum typically 1.20×` });
    } else if (dscr != null && dscr < 1.25) {
      score -= 10;
      actions.push({ sev: "warn", icon: "📊", text: `DSCR below 1.25× threshold: ${fin.dscr}` });
    }
    if (fin.covenantStatus === "Breached") {
      score -= 20;
      actions.push({ sev: "error", icon: "⚠️", text: "Loan covenant breached — lender notification required" });
    } else if (fin.covenantStatus === "At Risk") {
      score -= 10;
      actions.push({ sev: "warn", icon: "⚠️", text: "Loan covenant at risk — monitor closely" });
    }
    if (fin.anomalies?.length > 0) {
      score -= 3;
      actions.push({ sev: "warn", icon: "📉", text: `${fin.anomalies.length} financial anomaly(s) flagged by AI` });
    }
  }

  // ── Brand / PIP ──────────────────────────────────────────────────────────
  const brand = bySection["brand-standards"];
  if (brand?.complianceStatus === "PIP Required" || brand?.complianceStatus === "Non-Compliant") {
    score -= 5;
    actions.push({ sev: "warn", icon: "🏨", text: `Brand PIP required${brand.totalEstimatedPIPCost ? " — est. " + brand.totalEstimatedPIPCost : ""}` });
  }

  // ── Legal ────────────────────────────────────────────────────────────────
  const legal = bySection["legal"];
  if (legal?.complianceStatus === "Issues Found") {
    score -= 5;
    actions.push({ sev: "warn", icon: "⚖️", text: "Legal issues identified — review before closing" });
  }

  // ── Missing parties ──────────────────────────────────────────────────────
  const missing = requiredRoles.filter(r => !submittedRoles.has(r));
  if (missing.length > 0) {
    score -= missing.length * 5;
    actions.push({ sev: "info", icon: "⏳", text: `Awaiting: ${missing.map(r => getRoleLabel(r, { short: true })).join(", ")}` });
  }

  // ── Needs revision ───────────────────────────────────────────────────────
  for (const s of submissions.filter(s => s.status === "needs_revision")) {
    score -= 5;
    const label = getRoleLabel(s.role, { short: true });
    actions.push({ sev: "warn", icon: "🔄", text: `${label} submission flagged for revision${s.status_note ? ": " + s.status_note : ""}` });
  }

  return { score: Math.max(0, Math.min(100, score)), actions };
}

export const creAcquisitionPack = {
  id: "cre_acquisition",
  name: "CRE Acquisition",
  description: "Buying, refinancing, or converting a commercial property",
  checklistTitle: "Due Diligence Checklist",
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

export default creAcquisitionPack;
