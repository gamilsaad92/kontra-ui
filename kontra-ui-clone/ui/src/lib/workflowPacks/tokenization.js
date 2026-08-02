// ── Tokenization workflow pack ───────────────────────────────────────────────
//
// The platform's fourth pack, proving the engine generalizes to regulated
// capital markets transactions — tokenized asset issuances governed by
// frameworks like UAE ADGM/DFSA, EU MiCA, US Reg D, and Singapore MAS.
//
// Unlike the other packs (which track a purchase or a fundraising round),
// tokenization tracks an issuance pipeline: structuring the offering →
// onboarding and verifying investors (KYC/AML) → running the subscription
// period → executing the token issuance → opening secondary trading.
//
// Roles: Token Issuer (coordinator), Lead Investor, Legal Counsel,
// Compliance Officer, Transfer Agent.
//
// Built on genericPackFactory — the same generic health scoring / AI-fact
// extraction machinery the other packs use, with tokenization-specific
// dashboard judgement (KYC completion badge, subscription fill rate) layered
// on top as overrides.

import rolesConfig from "../../../../shared/workflowRoles.json";
import stagesConfig from "../../../../shared/workflowStages.json";
import { createGenericPack } from "./genericPackFactory";

export const roles = rolesConfig.tokenization.roles;

// ── Lifecycle stages ──────────────────────────────────────────────────────────
const STAGE_META = {
  structuring:  { icon: "📐" },
  onboarding:   { icon: "✅" },
  subscription: { icon: "📋" },
  issuance:     { icon: "🏛️" },
  secondary:    { icon: "📈" },
};
const STAGE_DESC = {
  structuring:  "Finalizing offering structure and regulatory filing",
  onboarding:   "Verifying investor KYC/AML and accreditation",
  subscription: "Subscription agreements being signed",
  issuance:     "Tokens issued to verified investors",
  secondary:    "Secondary market trading open",
};

export const stages = stagesConfig.tokenization.stages.map(s => ({
  ...s,
  ...(STAGE_META[s.key] || {}),
  desc: STAGE_DESC[s.key] || "",
}));

export const advanceLabel = {
  structuring:  "Move to Investor Onboarding",
  onboarding:   "Open Subscription Period",
  subscription: "Execute Token Issuance",
  issuance:     "Open Secondary Market",
};

// ── Document schema ───────────────────────────────────────────────────────────
// assignedTo: which role is responsible for uploading this document.
// issuer: core offering materials (TOM, cap table, regulatory filing)
// lead_investor: KYC/AML and accreditation documents
// counsel: subscription agreements and SAFT/SAFE
// compliance: KYC/AML completion certificate and regulatory sign-off
// transfer_agent: capitalization table and distribution schedule
const DOCUMENT_SCHEMA = [
  {
    id: "tom",
    label: "Token Offering Memorandum",
    section: "tom",
    ai: true,
    required: true,
    assignedTo: ["issuer"],
    aiExtraction: {
      analystRole: "securities lawyer reviewing a Token Offering Memorandum for a regulated token issuance",
      docTypes: ["Token Offering Memorandum", "Private Placement Memorandum", "Offering Document", "Other"],
      metrics: {
        raise_amount:        "total raise amount in dollars",
        token_price:         "price per token in dollars",
        total_tokens:        "total number of tokens being issued",
        minimum_investment:  "minimum investment per investor in dollars",
        offering_type:       "offering type or exemption (e.g. Reg D 506b, MiCA, ADGM FSRA)",
        use_of_proceeds:     "primary stated use of proceeds as a short phrase",
      },
    },
  },
  {
    id: "subscription_agreement",
    label: "Subscription Agreement",
    section: "subscription_agreement",
    ai: false,
    required: true,
    assignedTo: ["counsel"],
  },
  {
    id: "kyc_aml",
    label: "KYC / AML Completion Certificate",
    section: "kyc_aml",
    ai: true,
    required: true,
    assignedTo: ["compliance"],
    aiExtraction: {
      analystRole: "AML compliance officer reviewing a KYC/AML completion certificate",
      docTypes: ["KYC Certificate", "AML Verification", "Identity Verification Report", "Other"],
      metrics: {
        investors_verified:  "number of investors who have completed KYC/AML verification",
        investors_pending:   "number of investors with pending or incomplete KYC/AML",
        investors_rejected:  "number of investors rejected during KYC/AML screening",
      },
    },
  },
  {
    id: "regulatory_filing",
    label: "Regulatory Filing",
    section: "regulatory_filing",
    ai: false,
    required: true,
    assignedTo: ["counsel", "compliance"],
  },
  {
    id: "accreditation",
    label: "Investor Accreditation Documents",
    section: "accreditation",
    ai: false,
    required: true,
    assignedTo: ["lead_investor"],
  },
  {
    id: "saft",
    label: "SAFT / SAFE (if applicable)",
    section: "saft",
    ai: false,
    required: false,
    assignedTo: ["counsel"],
  },
  {
    id: "cap_table",
    label: "Capitalization Table",
    section: "cap_table",
    ai: true,
    required: true,
    assignedTo: ["transfer_agent"],
    aiExtraction: {
      analystRole: "transfer agent reviewing a token capitalization table",
      docTypes: ["Cap Table", "Capitalization Table", "Token Distribution Schedule", "Other"],
      metrics: {
        total_investors:     "total number of investors on the cap table",
        largest_holder_pct:  "percentage held by the largest single investor as a number 0-100",
        institutional_pct:   "percentage held by institutional investors as a number 0-100",
      },
    },
  },
];

function humanizeMetricKey(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    .replace(/Kyc/, "KYC").replace(/Aml/, "AML").replace(/Saft/, "SAFT").replace(/Pct/, "%");
}

function getExtraCompletenessIssues(analysis, section) {
  if (section === "kyc_aml") {
    const pending = Number(analysis.metrics?.investors_pending) || 0;
    const rejected = Number(analysis.metrics?.investors_rejected) || 0;
    const issues = [];
    if (pending > 0) issues.push({ text: `${pending} investor${pending > 1 ? "s" : ""} still pending KYC/AML — subscription cannot close until complete`, sev: "Critical" });
    if (rejected > 0) issues.push({ text: `${rejected} investor${rejected > 1 ? "s" : ""} rejected during KYC/AML screening — remove from cap table`, sev: "Critical" });
    return issues;
  }
  return [];
}

const intelligenceSections = [
  { key: "tom",     icon: "📄", label: "Token Offering Memorandum", color: "#800020" },
  { key: "kyc_aml", icon: "🛡️", label: "KYC / AML Certificate",    color: "#065f46" },
  { key: "cap_table", icon: "📊", label: "Cap Table",               color: "#1d4ed8" },
];

function kycBadge(pending, verified) {
  if (pending == null && verified == null) return null;
  const p = Number(pending) || 0;
  const v = Number(verified) || 0;
  if (p === 0 && v > 0) return { label: "KYC Complete", color: "#16a34a" };
  if (p > 0) return { label: `${p} Pending KYC`, color: "#dc2626" };
  return null;
}

function getIntelligenceBadge(section, analysis) {
  if (!analysis) return null;
  const metrics = analysis.metrics || {};
  if (section === "kyc_aml") return kycBadge(metrics.investors_pending, metrics.investors_verified);
  if (section === "tom") {
    const raise = Number(metrics.raise_amount) || 0;
    if (!raise) return null;
    return { label: `Raise: $${(raise / 1_000_000).toFixed(1)}M`, color: "#800020" };
  }
  if (section === "cap_table") {
    const largest = Number(metrics.largest_holder_pct) || 0;
    if (largest > 50) return { label: "Concentration Risk", color: "#dc2626" };
    if (largest > 25) return { label: "Moderate Concentration", color: "#d97706" };
    if (largest > 0) return { label: "Distributed Cap Table", color: "#16a34a" };
  }
  return null;
}

function getIntelligenceHighlight(section, analysis) {
  if (!analysis) return null;
  const metrics = analysis.metrics || {};
  if (section === "tom" && metrics.raise_amount != null) {
    return `Raise: $${Number(metrics.raise_amount).toLocaleString()}${metrics.token_price != null ? ` · Price: $${metrics.token_price}/token` : ""}`;
  }
  if (section === "kyc_aml" && metrics.investors_verified != null) {
    const total = (Number(metrics.investors_verified) || 0) + (Number(metrics.investors_pending) || 0);
    return `${metrics.investors_verified} of ${total} investors verified${metrics.investors_rejected ? ` · ${metrics.investors_rejected} rejected` : ""}`;
  }
  if (section === "cap_table" && metrics.total_investors != null) {
    return `${metrics.total_investors} investors${metrics.institutional_pct != null ? ` · ${metrics.institutional_pct}% institutional` : ""}`;
  }
  return null;
}

function getSnapshotStats(bySection) {
  const tom = bySection.tom?.metrics || {};
  const kyc = bySection.kyc_aml?.metrics || {};
  const cap = bySection.cap_table?.metrics || {};
  return [
    { label: "Raise Target",     value: tom.raise_amount    != null ? `$${Number(tom.raise_amount).toLocaleString()}` : null },
    { label: "Token Price",      value: tom.token_price     != null ? `$${tom.token_price}` : null },
    { label: "Offering Type",    value: tom.offering_type   || null },
    { label: "Investors Verified", value: kyc.investors_verified != null ? String(kyc.investors_verified) : null },
    { label: "KYC Pending",      value: kyc.investors_pending != null && Number(kyc.investors_pending) > 0 ? String(kyc.investors_pending) : null },
    { label: "Total Investors",  value: cap.total_investors != null ? String(cap.total_investors) : null },
  ].filter(s => s.value);
}

function getSnapshotFlag(bySection) {
  const kyc = bySection.kyc_aml?.metrics || {};
  if (Number(kyc.investors_pending) > 0) {
    return { text: `${kyc.investors_pending} investor${Number(kyc.investors_pending) > 1 ? "s" : ""} pending KYC — subscription cannot close until resolved`, sev: "error" };
  }
  if (Number(kyc.investors_rejected) > 0) {
    return { text: `${kyc.investors_rejected} investor${Number(kyc.investors_rejected) > 1 ? "s" : ""} failed KYC screening — remove from subscription list`, sev: "warn" };
  }
  return null;
}

export const onboardingSteps = [
  { icon: "📄", title: "Upload the Token Offering Memorandum", desc: "AI extracts the raise amount, token price, offering type, and use of proceeds automatically" },
  { icon: "🛡️", title: "Submit the KYC / AML completion certificate", desc: "Send the compliance officer link above; their verification report goes directly into the room" },
  { icon: "📊", title: "Add the capitalization table", desc: "AI tracks investor concentration and flags any single-investor cap table risk" },
];

// ── Issuance Details metadata fields ─────────────────────────────────────────
export const METADATA_FIELDS = [
  { id: "issuer_name",     label: "Issuer / Asset Name",     fieldType: "text",     fullWidth: true, placeholder: "e.g. Meridian Tower Token Fund I" },
  { id: "asset_type",      label: "Underlying Asset Type",   fieldType: "select",   options: ["Real Estate", "Private Equity", "Infrastructure", "Venture / Startup Equity", "Fund", "Commodity", "Other"] },
  { id: "jurisdiction",    label: "Governing Jurisdiction",  fieldType: "select",   options: ["UAE (ADGM / DFSA)", "European Union (MiCA)", "United States (Reg D)", "Singapore (MAS)", "United Kingdom (FCA)", "Other"] },
  { id: "raise_amount",    label: "Raise Amount ($)",        fieldType: "currency", placeholder: "e.g. 25000000" },
  { id: "token_price",     label: "Token Price ($)",         fieldType: "currency", placeholder: "e.g. 100" },
  { id: "total_tokens",    label: "Total Tokens Issued",     fieldType: "number",   placeholder: "e.g. 250000" },
  { id: "min_investment",  label: "Minimum Investment ($)",  fieldType: "currency", placeholder: "e.g. 10000" },
  { id: "target_close_date", label: "Target Close Date",    fieldType: "date" },
];

export const tokenizationPack = createGenericPack({
  id: "tokenization",
  name: "Token Issuance",
  description: "Regulated token offering (structuring through secondary market)",
  checklistTitle: "Issuance Checklist",
  onboardingSteps,
  roles,
  stages,
  advanceLabel,
  documentSchema: DOCUMENT_SCHEMA,
  humanizeMetricKey,
  dollarMetricPattern: /raise|price|investment|amount/i,
  getExtraCompletenessIssues,
  intelligenceSections,
  getIntelligenceBadge,
  getIntelligenceHighlight,
  getSnapshotStats,
  getSnapshotFlag,
  metadataFields: METADATA_FIELDS,
  metadataLabel: "Issuance Details",
  outstandingItemsSections: ["metadata", "compliance"],
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
} = tokenizationPack;

export default tokenizationPack;
