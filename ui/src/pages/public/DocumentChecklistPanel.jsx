import { useState, useEffect, useRef } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

// ── Templates per property type ────────────────────────────────────────────────
const TEMPLATES = {
  Multifamily: [
    { id: "purchase_agreement", label: "Purchase Agreement",            section: "purchase_agreement", ai: false, required: true },
    { id: "rent_roll",          label: "Rent Roll",                     section: "rent_roll",          ai: false, required: true },
    { id: "financials",         label: "T-12 Financial Statement",      section: "financials",         ai: true,  required: true },
    { id: "insurance",          label: "Insurance Certificate",         section: "insurance",          ai: true,  required: true },
    { id: "inspection",         label: "Property Inspection Report",    section: "inspection",         ai: true,  required: true },
    { id: "estoppel",           label: "Estoppel Certificates",         section: "estoppel",           ai: false, required: false },
    { id: "environmental",      label: "Environmental Report (Phase I)",section: "environmental",      ai: false, required: true },
    { id: "survey",             label: "Survey / ALTA",                 section: "survey",             ai: false, required: false },
    { id: "title",              label: "Title Commitment",              section: "title",              ai: false, required: true },
  ],
  Office: [
    { id: "purchase_agreement", label: "Purchase Agreement",            section: "purchase_agreement", ai: false, required: true },
    { id: "rent_roll",          label: "Rent Roll",                     section: "rent_roll",          ai: false, required: true },
    { id: "financials",         label: "T-12 Financial Statement",      section: "financials",         ai: true,  required: true },
    { id: "insurance",          label: "Insurance Certificate",         section: "insurance",          ai: true,  required: true },
    { id: "inspection",         label: "Property Inspection Report",    section: "inspection",         ai: true,  required: true },
    { id: "estoppel",           label: "Estoppel / Lease Abstracts",    section: "estoppel",           ai: false, required: true },
    { id: "environmental",      label: "Environmental Report (Phase I)",section: "environmental",      ai: false, required: true },
    { id: "survey",             label: "Survey / ALTA",                 section: "survey",             ai: false, required: false },
    { id: "title",              label: "Title Commitment",              section: "title",              ai: false, required: true },
    { id: "legal",              label: "Loan / Legal Documents",        section: "legal",              ai: true,  required: false },
  ],
  Industrial: [
    { id: "purchase_agreement", label: "Purchase Agreement",            section: "purchase_agreement", ai: false, required: true },
    { id: "financials",         label: "Financial Statement",           section: "financials",         ai: true,  required: true },
    { id: "insurance",          label: "Insurance Certificate",         section: "insurance",          ai: true,  required: true },
    { id: "inspection",         label: "Property Inspection Report",    section: "inspection",         ai: true,  required: true },
    { id: "environmental",      label: "Environmental Report (Phase I)",section: "environmental",      ai: false, required: true },
    { id: "survey",             label: "Survey / ALTA",                 section: "survey",             ai: false, required: false },
    { id: "title",              label: "Title Commitment",              section: "title",              ai: false, required: true },
    { id: "legal",              label: "Lease / Legal Documents",       section: "legal",              ai: true,  required: false },
  ],
  Hotel: [
    { id: "purchase_agreement", label: "Purchase Agreement",            section: "purchase_agreement", ai: false, required: true },
    { id: "brand_standards",    label: "PIP / Brand Standards",         section: "brand-standards",    ai: true,  required: true },
    { id: "legal",              label: "Franchise Agreement",           section: "legal",              ai: true,  required: true },
    { id: "financials",         label: "STR / P&L Statement",           section: "financials",         ai: true,  required: true },
    { id: "insurance",          label: "Insurance Certificate",         section: "insurance",          ai: true,  required: true },
    { id: "inspection",         label: "Property Inspection Report",    section: "inspection",         ai: true,  required: true },
    { id: "environmental",      label: "Environmental Report (Phase I)",section: "environmental",      ai: false, required: true },
    { id: "survey",             label: "Survey / ALTA",                 section: "survey",             ai: false, required: false },
    { id: "title",              label: "Title Commitment",              section: "title",              ai: false, required: true },
  ],
  Retail: [
    { id: "purchase_agreement", label: "Purchase Agreement",            section: "purchase_agreement", ai: false, required: true },
    { id: "rent_roll",          label: "Rent Roll",                     section: "rent_roll",          ai: false, required: true },
    { id: "financials",         label: "T-12 Financial Statement",      section: "financials",         ai: true,  required: true },
    { id: "insurance",          label: "Insurance Certificate",         section: "insurance",          ai: true,  required: true },
    { id: "inspection",         label: "Property Inspection Report",    section: "inspection",         ai: true,  required: true },
    { id: "estoppel",           label: "Estoppel / Lease Abstracts",    section: "estoppel",           ai: false, required: true },
    { id: "environmental",      label: "Environmental Report (Phase I)",section: "environmental",      ai: false, required: true },
    { id: "survey",             label: "Survey / ALTA",                 section: "survey",             ai: false, required: false },
    { id: "title",              label: "Title Commitment",              section: "title",              ai: false, required: true },
  ],
};

// Default for unknown types
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

// ── Extract completeness issues from AI analysis ───────────────────────────────
function getCompletenessIssues(analysis, section) {
  if (!analysis || typeof analysis !== "object") return [];
  const issues = [];

  if (section === "insurance") {
    (analysis.coverageGaps || [])
      .filter(g => ["Critical", "Moderate"].includes(g.severity))
      .forEach(g => issues.push({ text: g.gap, sev: g.severity }));
    if (analysis.complianceStatus === "Action Needed") {
      issues.push({ text: "Policy compliance action required", sev: "Critical" });
    }
  }
  if (section === "inspection") {
    (analysis.lifeSafetyFindings || [])
      .forEach(f => issues.push({ text: `Life safety: ${f.item}`, sev: f.severity || "Critical" }));
    if (analysis.overallCondition === "Poor") {
      issues.push({ text: "Overall condition rated Poor — lender review required", sev: "Critical" });
    }
  }
  if (section === "legal") {
    (analysis.redFlags || [])
      .filter(f => ["Critical", "Moderate"].includes(f.severity))
      .forEach(f => issues.push({ text: f.issue, sev: f.severity }));
    if (analysis.complianceStatus === "Issues Found") {
      issues.push({ text: "Legal compliance issues found — attorney review needed", sev: "Critical" });
    }
  }
  if (section === "financials") {
    (analysis.anomalies || [])
      .filter(a => a.severity === "High")
      .forEach(a => issues.push({ text: a.description, sev: "Critical" }));
    if (analysis.covenantStatus === "Breached") {
      issues.push({ text: "Loan covenant breached — lender notification required", sev: "Critical" });
    } else if (analysis.covenantStatus === "At Risk") {
      issues.push({ text: "Covenant at risk — monitor before close", sev: "Moderate" });
    }
  }
  if (section === "brand-standards") {
    (analysis.redFlags || [])
      .filter(f => f.severity === "Critical")
      .forEach(f => issues.push({ text: f.issue, sev: "Critical" }));
    if (analysis.totalEstimatedPIPCost) {
      issues.push({ text: `PIP cost estimate: ${analysis.totalEstimatedPIPCost}`, sev: "Moderate" });
    }
  }
  return issues;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DocumentChecklistPanel({ propertyId, propertyType, role, isDemo = false }) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingSection, setUploadingSection] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const fileRefs = useRef({});

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses`)
      .then(r => r.json())
      .then(d => { setAnalyses(d.analyses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propertyId, refreshKey]);

  const template = getTemplate(propertyType);
  const uploadedSections = new Set(analyses.map(a => a.section));
  const analysisBySection = Object.fromEntries(analyses.map(a => [a.section, a.analysis]));

  const requiredItems = template.filter(i => i.required);
  const doneCount = template.filter(i => uploadedSections.has(i.section)).length;
  const requiredDone = requiredItems.filter(i => uploadedSections.has(i.section)).length;
  const pct = template.length > 0 ? Math.round((doneCount / template.length) * 100) : 0;
  const allRequiredDone = requiredDone === requiredItems.length;

  // All completeness issues across uploaded AI sections
  const allIssues = analyses.flatMap(a =>
    getCompletenessIssues(a.analysis, a.section).map(issue => ({ ...issue, section: a.section, filename: a.filename }))
  );
  const criticalIssues = allIssues.filter(i => i.sev === "Critical");

  async function handleLightweightUpload(section, file) {
    if (!file) return;
    setUploadingSection(section);
    setUploadError("");
    const form = new FormData();
    form.append("file", file);
    form.append("property_id", propertyId);
    form.append("section", section);
    form.append("role", role || "owner");
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/track-document`, {
        method: "POST",
        body: form,
      });
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
              ⚠️ {criticalIssues.length} issue{criticalIssues.length > 1 ? "s" : ""}
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
              {/* Checklist items */}
              <div className="divide-y divide-gray-50">
                {template.map((item) => {
                  const done = uploadedSections.has(item.section);
                  const isUploading = uploadingSection === item.section;
                  const analysis = analysisBySection[item.section];
                  const issues = done ? getCompletenessIssues(analysis, item.section) : [];
                  const hasIssues = issues.length > 0;

                  return (
                    <div key={item.id} className="py-2.5 flex items-start gap-3">
                      {/* Status icon */}
                      <div className="shrink-0 mt-0.5">
                        {done ? (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: hasIssues ? "#fef3c7" : "#dcfce7" }}>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"
                              style={{ color: hasIssues ? "#d97706" : "#16a34a" }}>
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white" />
                        )}
                      </div>

                      {/* Label + issues */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm ${done ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                            {item.label}
                          </span>
                          {!item.required && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">optional</span>
                          )}
                          {item.ai && done && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium">AI analyzed</span>
                          )}
                        </div>
                        {/* Completeness issues (Feature 3) */}
                        {issues.map((issue, i) => (
                          <div key={i} className="flex items-start gap-1 mt-1">
                            <span className="text-xs shrink-0" style={{ color: issue.sev === "Critical" ? "#dc2626" : "#d97706" }}>
                              {issue.sev === "Critical" ? "⚠️" : "⬥"}
                            </span>
                            <span className="text-xs leading-tight"
                              style={{ color: issue.sev === "Critical" ? "#dc2626" : "#d97706" }}>
                              {issue.text}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Upload button for non-AI lightweight docs */}
                      {!done && !isDemo && !item.ai && (
                        <div className="shrink-0">
                          <input
                            type="file"
                            className="hidden"
                            ref={el => { fileRefs.current[item.section] = el; }}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) handleLightweightUpload(item.section, f);
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
                      {!done && !isDemo && item.ai && (
                        <span className="shrink-0 text-[11px] text-gray-400 italic">
                          Use upload card ↓
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {uploadError && (
                <p className="text-xs text-red-600 mt-2">{uploadError}</p>
              )}

              {/* AI completeness summary — critical issues only (Feature 3) */}
              {criticalIssues.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-xs font-bold text-red-700 mb-2">
                    ⚠️ AI flagged {criticalIssues.length} critical item{criticalIssues.length > 1 ? "s" : ""} across uploaded documents
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

              {/* All required done celebration */}
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
