import { useState, useEffect, useRef } from "react";
import { getWorkflowPack, DEFAULT_PACK_ID } from "../../lib/workflowPacks";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

export default function DocumentChecklistPanel({ propertyId, propertyType, role, isDemo = false, packId = DEFAULT_PACK_ID }) {
  const workflowPack = getWorkflowPack(packId);
  const { getInlineFacts, getCompletenessIssues, factColors: FACT_COLORS, aiUploadEndpoints: AI_UPLOAD_ENDPOINTS } = workflowPack;

  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingSection, setUploadingSection] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [expandedItems, setExpandedItems] = useState({});
  const fileRefs = useRef({});

  // ── Per-deal customisation (localStorage, owner only) ───────────────────────
  const CUSTOM_KEY  = propertyId ? `kontra_custom_docs_${propertyId}`   : null;
  const REMOVED_KEY = propertyId ? `kontra_removed_docs_${propertyId}`  : null;

  const [customDocs, setCustomDocs] = useState(() => {
    if (!CUSTOM_KEY) return [];
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]"); } catch { return []; }
  });
  const [removedSections, setRemovedSections] = useState(() => {
    if (!REMOVED_KEY) return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(REMOVED_KEY) || "[]")); } catch { return new Set(); }
  });

  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addDocLabel, setAddDocLabel] = useState("");

  function saveRemovedSections(next) {
    setRemovedSections(next);
    if (REMOVED_KEY) localStorage.setItem(REMOVED_KEY, JSON.stringify([...next]));
  }

  function handleRemovePackItem(section) {
    saveRemovedSections(new Set([...removedSections, section]));
  }

  function handleAddDoc() {
    if (!addDocLabel.trim()) return;
    const section = `custom_${Date.now()}`;
    const newDoc = { id: section, label: addDocLabel.trim(), section, required: false, isCustom: true, ai: false };
    const updated = [...customDocs, newDoc];
    setCustomDocs(updated);
    if (CUSTOM_KEY) localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated));
    setAddDocLabel("");
    setAddDocOpen(false);
  }

  function handleRemoveCustomDoc(section) {
    const updated = customDocs.filter(d => d.section !== section);
    setCustomDocs(updated);
    if (CUSTOM_KEY) localStorage.setItem(CUSTOM_KEY, JSON.stringify(updated));
  }

  function handleRestoreDefaults() {
    saveRemovedSections(new Set());
  }

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses`)
      .then(r => r.json())
      .then(d => { setAnalyses(d.analyses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propertyId, refreshKey]);

  useEffect(() => {
    const hasPending = analyses.some(a => a.analysis?.pending);
    if (!hasPending) return;
    const t = setTimeout(() => setRefreshKey(k => k + 1), 8000);
    return () => clearTimeout(t);
  }, [analyses]);

  const packTemplate = workflowPack.getDocumentSchema(propertyType);
  // Full list = visible pack items + custom items
  const visiblePackItems = packTemplate.filter(i => !removedSections.has(i.section));
  const template = [...visiblePackItems, ...customDocs];

  const uploadedSections = new Set(analyses.map(a => a.section));
  const analysisBySection = Object.fromEntries(analyses.map(a => [a.section, a.analysis]));

  const requiredItems = template.filter(i => i.required);
  const doneCount = template.filter(i => uploadedSections.has(i.section)).length;
  const requiredDone = requiredItems.filter(i => uploadedSections.has(i.section)).length;
  const pct = template.length > 0 ? Math.round((doneCount / template.length) * 100) : 0;
  const allRequiredDone = requiredDone === requiredItems.length && requiredItems.length > 0;

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
    const docEntry = template.find(t => t.section === section);
    if (docEntry?.aiExtraction) {
      if (docEntry.aiExtraction.analystRole) form.append("analystRole", docEntry.aiExtraction.analystRole);
      if (docEntry.aiExtraction.docTypes) form.append("docTypes", JSON.stringify(docEntry.aiExtraction.docTypes));
      if (docEntry.aiExtraction.metrics) form.append("metricsSchema", JSON.stringify(docEntry.aiExtraction.metrics));
    }
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

  const isOwner = role === "owner";
  const statusColor = allRequiredDone ? "#16a34a" : pct > 50 ? "#d97706" : "#800020";
  const statusLabel = allRequiredDone ? "Complete" : template.length === 0 ? "Empty" : `${doneCount} of ${template.length} uploaded`;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition text-left">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-base font-bold text-gray-900">Due Diligence Checklist</div>
          {!loading && template.length > 0 && (
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
          {removedSections.size > 0 && isOwner && !isDemo && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-400">
              {removedSections.size} hidden
            </span>
          )}
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Progress bar */}
      {!loading && template.length > 0 && (
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
              {template.length === 0 ? (
                <p className="text-sm text-gray-400 py-3 text-center">No documents in checklist — add one below.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {template.map((item) => {
                    const done = uploadedSections.has(item.section);
                    const isUploading = uploadingSection === item.section;
                    const analysis = analysisBySection[item.section];
                    const isPending = analysis?.pending;
                    const issues = done && !isPending ? getCompletenessIssues(analysis, item.section) : [];
                    const facts = done && !isPending ? getInlineFacts(analysis, item.section) : [];
                    const hasIssues = issues.length > 0;
                    const isItemExpanded = expandedItems[item.section];
                    const isAiEndpoint = !!AI_UPLOAD_ENDPOINTS[item.section];

                    return (
                      <div key={item.id} className="py-3 group/item">
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
                              <span className={`text-sm ${done ? "text-gray-900 font-medium" : "text-gray-600"}`}>
                                {item.label}
                              </span>
                              {!item.required && !item.isCustom && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">optional</span>
                              )}
                              {item.isCustom && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-400 font-medium">custom</span>
                              )}
                              {isPending && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium animate-pulse">AI analyzing…</span>
                              )}
                            </div>

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

                            {done && !isPending && (issues.length > 0 || analysis?.summary) && (
                              <button
                                onClick={() => setExpandedItems(s => ({ ...s, [item.section]: !s[item.section] }))}
                                className="text-[11px] text-gray-400 hover:text-gray-600 mt-1 flex items-center gap-0.5 transition">
                                {isItemExpanded ? "▲ Hide details" : `▼ ${issues.length > 0 ? `${issues.length} flag${issues.length > 1 ? "s" : ""} · ` : ""}AI summary`}
                              </button>
                            )}

                            {isItemExpanded && (
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

                          {/* Actions */}
                          <div className="shrink-0 flex items-center gap-1.5">
                            {!done && !isDemo && (
                              <>
                                <input type="file" className="hidden"
                                  ref={el => { fileRefs.current[item.section] = el; }}
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.csv"
                                  onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUpload(item.section, f, isAiEndpoint);
                                    e.target.value = "";
                                  }}
                                />
                                <button disabled={isUploading}
                                  onClick={() => fileRefs.current[item.section]?.click()}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-40">
                                  {isUploading ? "Uploading…" : "↑ Upload"}
                                </button>
                              </>
                            )}
                            {done && !isDemo && (
                              <>
                                <input type="file" className="hidden"
                                  ref={el => { fileRefs.current[`re_${item.section}`] = el; }}
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.csv"
                                  onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUpload(item.section, f, isAiEndpoint);
                                    e.target.value = "";
                                  }}
                                />
                                <button disabled={isUploading || isPending}
                                  onClick={() => fileRefs.current[`re_${item.section}`]?.click()}
                                  className="px-2 py-0.5 rounded text-[10px] font-medium border border-gray-100 text-gray-300 hover:text-gray-500 hover:border-gray-200 transition disabled:opacity-30">
                                  re-upload
                                </button>
                              </>
                            )}
                            {/* Remove — visible on hover for owner, not in demo */}
                            {isOwner && !isDemo && (
                              <button
                                onClick={() => item.isCustom ? handleRemoveCustomDoc(item.section) : handleRemovePackItem(item.section)}
                                title="Remove from checklist"
                                className="opacity-0 group-hover/item:opacity-100 text-gray-200 hover:text-red-400 transition text-xs px-1 leading-none">
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer: add doc + restore */}
              {!isDemo && isOwner && (
                <div className="pt-3 mt-1 border-t border-gray-100 flex items-center justify-between gap-4">
                  {addDocOpen ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Document name (e.g. Environmental Indemnity)"
                        value={addDocLabel}
                        onChange={e => setAddDocLabel(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleAddDoc();
                          if (e.key === "Escape") { setAddDocOpen(false); setAddDocLabel(""); }
                        }}
                        className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
                      />
                      <button onClick={handleAddDoc} disabled={!addDocLabel.trim()}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition disabled:opacity-40"
                        style={{ background: "#800020" }}>
                        Add
                      </button>
                      <button onClick={() => { setAddDocOpen(false); setAddDocLabel(""); }}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] text-gray-400 hover:text-gray-600 border border-gray-200 transition">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setAddDocOpen(true)}
                      className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition group">
                      <span className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300 group-hover:border-gray-400 flex items-center justify-center text-[10px] leading-none">+</span>
                      Add a document
                    </button>
                  )}
                  {removedSections.size > 0 && !addDocOpen && (
                    <button onClick={handleRestoreDefaults}
                      className="text-[10px] text-gray-400 hover:text-gray-600 underline transition shrink-0">
                      Restore {removedSections.size} hidden
                    </button>
                  )}
                </div>
              )}

              {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}

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
                    {criticalIssues.length > 5 && <li className="text-xs text-red-400">+{criticalIssues.length - 5} more…</li>}
                  </ul>
                </div>
              )}

              {allRequiredDone && criticalIssues.length === 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <div>
                    <p className="text-xs font-bold text-green-700">All required documents uploaded</p>
                    <p className="text-xs text-green-600">No critical issues flagged by AI. This deal is ready for final review.</p>
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
