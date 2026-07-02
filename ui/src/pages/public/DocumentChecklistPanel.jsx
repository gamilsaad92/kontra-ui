import { useState, useEffect, useRef } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

// ── Templates per property type ────────────────────────────────────────────────
const TEMPLATES = {
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

const DEFAULT_TEMPLATE = TEMPLATES.Multifamily;

function getTemplate(propertyType) {
  if (!propertyType) return DEFAULT_TEMPLATE;
  const t = propertyType.toLowerCase();
  if (t.includes("hotel") || t.includes("hospitality") || t.includes("motel")) return TEMPLATES.Hotel;
  if (t.includes("office")) return TEMPLATES.Office;
  if (t.includes("industrial") || t.includes("warehouse")) return TEMPLATES.Industrial;
  if (t.includes("retail") || t.includes("strip") || t.includes("shopping")) return TEMPLATES.Retail;
  return TEMPLATES.Multifamily;
}

// ── Extract inline key facts per section ──────────────────────────────────────
function getInlineFacts(analysis, section) {
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

// ── Extract completeness issues from AI analysis ───────────────────────────────
function getCompletenessIssues(analysis, section) {
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

const FACT_COLORS = {
  good: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  warn: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  neutral: { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
};

// ── Upload endpoint mapping ────────────────────────────────────────────────────
const AI_UPLOAD_ENDPOINTS = {
  inspection: "/api/ai/analyze-inspection",
  insurance: "/api/ai/review-insurance",
  financials: "/api/ai/review-financials",
  legal: "/api/ai/review-legal",
  "brand-standards": "/api/ai/review-brand-standards",
};
const TRACK_SECTIONS = new Set(["purchase_agreement","rent_roll","estoppel","environmental","survey","title"]);

// ── Main component ─────────────────────────────────────────────────────────────
export default function DocumentChecklistPanel({ propertyId, propertyType, role, isDemo = false }) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingSection, setUploadingSection] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [expandedItems, setExpandedItems] = useState({});
  const fileRefs = useRef({});

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses`)
      .then(r => r.json())
      .then(d => { setAnalyses(d.analyses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propertyId, refreshKey]);

  // Poll for pending analyses every 8s
  useEffect(() => {
    const hasPending = analyses.some(a => a.analysis?.pending);
    if (!hasPending) return;
    const t = setTimeout(() => setRefreshKey(k => k + 1), 8000);
    return () => clearTimeout(t);
  }, [analyses]);

  const template = getTemplate(propertyType);
  const uploadedSections = new Set(analyses.map(a => a.section));
  const analysisBySection = Object.fromEntries(analyses.map(a => [a.section, a.analysis]));
  const filenameBySection = Object.fromEntries(analyses.map(a => [a.section, a.filename]));

  const requiredItems = template.filter(i => i.required);
  const doneCount = template.filter(i => uploadedSections.has(i.section)).length;
  const requiredDone = requiredItems.filter(i => uploadedSections.has(i.section)).length;
  const pct = template.length > 0 ? Math.round((doneCount / template.length) * 100) : 0;
  const allRequiredDone = requiredDone === requiredItems.length;

  const allIssues = analyses.flatMap(a =>
    getCompletenessIssues(a.analysis, a.section).map(issue => ({ ...issue, section: a.section, filename: a.filename }))
  );
  const criticalIssues = allIssues.filter(i => i.sev === "Critical");

  async function handleUpload(section, file, isAiEndpoint) {
    if (!file) return;
    setUploadingSection(section);
    setUploadError("");
    const form = new FormData();
    form.append("file", file);
    form.append("property_id", propertyId);
    form.append("section", section);
    form.append("role", role || "owner");
    try {
      const endpoint = isAiEndpoint
        ? `${API_BASE}${AI_UPLOAD_ENDPOINTS[section]}`
        : `${API_BASE}/api/public/deal-room/${propertyId}/track-document`;
      const res = await fetch(endpoint, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      setRefreshKey(k => k + 1);
    } catch {
      setUploadError("Upload failed — try again.");
    } finally {
      setUploadingSection(null);
    }
  }

  const statusColor = allRequiredDone ? "#16a34a" : pct > 50 ? "#d97706" : "#800020";
  const statusLabel = allRequiredDone ? "Complete" : `${doneCount} of ${template.length} uploaded`;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition text-left">
        <div className="flex items-center gap-3">
          <div className="text-base font-bold text-gray-900">Due Diligence Checklist</div>
          {!loading && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ background: statusColor }}>
              {statusLabel}
            </span>
          )}
          {criticalIssues.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
              ⚠ {criticalIssues.length} issue{criticalIssues.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Progress bar */}
      {!loading && (
        <div className="px-5 pb-1">
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: statusColor }} />
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-5 pt-3 pb-4">
          {loading ? (
            <div className="text-center py-6 text-sm text-gray-400">Loading checklist…</div>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {template.map((item) => {
                  const done = uploadedSections.has(item.section);
                  const isUploading = uploadingSection === item.section;
                  const analysis = analysisBySection[item.section];
                  const isPending = analysis?.pending;
                  const issues = done && !isPending ? getCompletenessIssues(analysis, item.section) : [];
                  const facts = done && !isPending ? getInlineFacts(analysis, item.section) : [];
                  const hasIssues = issues.length > 0;
                  const isExpanded = expandedItems[item.section];
                  const isAiEndpoint = !!AI_UPLOAD_ENDPOINTS[item.section];

                  return (
                    <div key={item.id} className="py-3">
                      <div className="flex items-start gap-3">
                        {/* Status icon */}
                        <div className="shrink-0 mt-0.5">
                          {done ? (
                            isPending ? (
                              <div className="w-5 h-5 rounded-full border-2 border-blue-300 bg-blue-50 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ background: hasIssues ? "#fef3c7" : "#dcfce7" }}>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"
                                  style={{ color: hasIssues ? "#d97706" : "#16a34a" }}>
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white" />
                          )}
                        </div>

                        {/* Label + facts */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm ${done ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                              {item.label}
                            </span>
                            {!item.required && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">optional</span>
                            )}
                            {isPending && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium animate-pulse">AI analyzing…</span>
                            )}
                          </div>

                          {/* Inline key facts */}
                          {facts.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {facts.map((f, i) => {
                                const c = FACT_COLORS[f.type] || FACT_COLORS.neutral;
                                return (
                                  <span key={i} className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                                    style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                                    {f.label}: {f.value}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Expand toggle for issues + summary */}
                          {done && !isPending && (issues.length > 0 || analysis?.summary) && (
                            <button
                              onClick={() => setExpandedItems(s => ({ ...s, [item.section]: !s[item.section] }))}
                              className="text-[11px] text-gray-400 hover:text-gray-600 mt-1 flex items-center gap-0.5 transition">
                              {isExpanded ? "▲ Hide details" : `▼ ${issues.length > 0 ? `${issues.length} flag${issues.length > 1 ? "s" : ""} · ` : ""}AI summary`}
                            </button>
                          )}

                          {/* Expanded: issues + summary */}
                          {isExpanded && (
                            <div className="mt-2 space-y-1">
                              {issues.map((issue, i) => (
                                <div key={i} className="flex items-start gap-1">
                                  <span className="text-xs shrink-0" style={{ color: issue.sev === "Critical" ? "#dc2626" : "#d97706" }}>
                                    {issue.sev === "Critical" ? "⚠" : "⬥"}
                                  </span>
                                  <span className="text-xs leading-tight"
                                    style={{ color: issue.sev === "Critical" ? "#dc2626" : "#d97706" }}>
                                    {issue.text}
                                  </span>
                                </div>
                              ))}
                              {analysis?.summary && (
                                <p className="text-xs text-gray-500 leading-relaxed mt-1 italic">
                                  {analysis.summary}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Upload button */}
                        {!done && !isDemo && (
                          <div className="shrink-0">
                            <input
                              type="file"
                              className="hidden"
                              ref={el => { fileRefs.current[item.section] = el; }}
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.csv"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) handleUpload(item.section, f, isAiEndpoint);
                                e.target.value = "";
                              }}
                            />
                            <button
                              disabled={isUploading}
                              onClick={() => fileRefs.current[item.section]?.click()}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-40">
                              {isUploading ? "Uploading…" : "↑ Upload"}
                            </button>
                          </div>
                        )}
                        {done && !isDemo && (
                          <div className="shrink-0">
                            <input
                              type="file"
                              className="hidden"
                              ref={el => { fileRefs.current[`re_${item.section}`] = el; }}
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.csv"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) handleUpload(item.section, f, isAiEndpoint);
                                e.target.value = "";
                              }}
                            />
                            <button
                              disabled={isUploading || isPending}
                              onClick={() => fileRefs.current[`re_${item.section}`]?.click()}
                              className="px-2 py-0.5 rounded text-[10px] font-medium border border-gray-100 text-gray-300 hover:text-gray-500 hover:border-gray-200 transition disabled:opacity-30">
                              re-upload
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {uploadError && (
                <p className="text-xs text-red-600 mt-2">{uploadError}</p>
              )}

              {/* Critical issues summary */}
              {criticalIssues.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-xs font-bold text-red-700 mb-2">
                    ⚠ AI flagged {criticalIssues.length} critical item{criticalIssues.length > 1 ? "s" : ""} across uploaded documents
                  </p>
                  <ul className="space-y-1">
                    {criticalIssues.slice(0, 5).map((issue, i) => (
                      <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                        <span className="shrink-0 mt-px">•</span>
                        <span>{issue.text}</span>
                      </li>
                    ))}
                    {criticalIssues.length > 5 && (
                      <li className="text-xs text-red-400">+{criticalIssues.length - 5} more…</li>
                    )}
                  </ul>
                </div>
              )}

              {/* All required done */}
              {allRequiredDone && criticalIssues.length === 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <div>
                    <p className="text-xs font-bold text-green-700">All required documents uploaded</p>
                    <p className="text-xs text-green-600">No critical issues flagged by AI. This deal is ready for lender review.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
