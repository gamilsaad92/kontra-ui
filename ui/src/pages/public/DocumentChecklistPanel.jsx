            <p className="mt-1 text-[11px] text-gray-400">
              {additionalItems.length} optional document{additionalItems.length === 1 ? "" : "s"} — 
              <button onClick={() => setShowAdditional(true)} className="ml-1 text-[#800020] font-semibold hover:opacity-80 transition">
                Show
              </button>
            </p>
          )}
          {showAdditional && (
            <div className="mt-3 space-y-4">
              {additionalGroups.map(renderGroup)}
            </div>
          )}
        </div>
      )}

      {/* N/A items — small footer note only */}
      {naItems.length > 0 && (
        <p className="text-[10px] text-gray-400">{naItems.length} document{naItems.length === 1 ? "" : "s"} marked not applicable.</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DocumentChecklistPanel({
  propertyId, propertyType, role, isDemo = false,
  packId = DEFAULT_PACK_ID, packReady = true, onAnalysisSaved,
  jurisdiction, onPeople,
}) {
  const workflowPack = getWorkflowPack(packId);
  const { getInlineFacts, getCompletenessIssues, factColors: FACT_COLORS, aiUploadEndpoints: AI_UPLOAD_ENDPOINTS } = workflowPack;

  // ── Analyses (uploaded docs + AI results) ────────────────────────────────
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingSection, setUploadingSection] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [expandedItems, setExpandedItems] = useState({});
  const fileRefs = useRef({});

  // ── Checklist items (persisted) ──────────────────────────────────────────
  const [items, setItems] = useState(null); // null = not loaded yet
  const [savingChecklist, setSavingChecklist] = useState(false);
  const saveTimerRef = useRef(null);

  // ── Edit / reorder / suggestion drawer state ────────────────────────────
  const [editingId, setEditingId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [addDocLabel, setAddDocLabel] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  // ── Task #143: document request state ───────────────────────────────────
  // requestingDocSection: which doc is currently sending a request
  // requestedDocSections: set of sections whose request was already sent this session
  const [requestingDocSection, setRequestingDocSection] = useState(null);
  const [requestedDocSections, setRequestedDocSections] = useState(new Set());
  const [requestError, setRequestError] = useState(null);

  // ── Role + coordinator check ─────────────────────────────────────────────
  const roleConfig = workflowPack.getRole?.(role);
  const isCoordinator = !!roleConfig?.canManage;
  const packRoles = workflowPack.roles || [];

  // ── Load analyses ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    const roleParam = role ? `?role=${encodeURIComponent(role)}` : "";
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses${roleParam}`, {
      headers: getRoomAuthHeaders(propertyId),
    })
      .then(r => r.json())
      .then(d => { setAnalyses(d.analyses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [propertyId, refreshKey, role]);

  // Auto-refresh if any analysis is pending
  useEffect(() => {
    const hasPending = analyses.some(a => a.analysis?.pending);
    if (!hasPending) return;
    const t = setTimeout(() => setRefreshKey(k => k + 1), 8000);
    return () => clearTimeout(t);
  }, [analyses]);

  // ── Load checklist items ──────────────────────────────────────────────────
  // packReady guards against seeding from the CRE fallback pack before the
  // room's actual custom pack has been fetched and registered client-side.
  // For built-in packs (CRE / BA / Fundraising) packReady is always true.
  useEffect(() => {
    if (!propertyId || !packReady) return;
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/checklist`, {
      headers: getRoomAuthHeaders(propertyId),
    })
      .then(r => r.ok ? r.json() : { items: null })
      .then(d => {
        if (d.items && Array.isArray(d.items) && d.items.length > 0) {
          // Re-number sortOrder for consistency
          setItems(d.items.map((i, idx) => ({ ...i, sortOrder: idx })));
        } else {
          // First visit: seed from the NOW-CORRECT pack, then immediately persist
          const seeded = seedFromPack(workflowPack, propertyType, jurisdiction);
          setItems(seeded);
          if (seeded.length > 0) persistItems(seeded);
        }
      })
      .catch(() => {
        // Offline fallback: seed from pack without persisting
        setItems(seedFromPack(workflowPack, propertyType, jurisdiction));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, packReady, role]);

  // ── Task #143: Request a document from an invited participant ──────────────
  async function handleRequestDoc(item) {
    if (!propertyId || isDemo) return;
    setRequestingDocSection(item.section);
    setRequestError(null);
    let ownerToken = "";
    try { ownerToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ""; } catch { /* storage unavailable */ }
    try {
      const response = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/request-document`, {
        method: "POST",
          headers: getRoomAuthHeaders(propertyId, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          ownerWriteToken: ownerToken,
          roles: item.assignedTo || [],
          docLabel: item.label,
          docSection: item.section,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Request failed");
      if (result.reason === "no_participant_found") {
        setRequestError({ section: item.section, message: "Invite the assigned participant before requesting this document.", roles: item.assignedTo || [] });
        return false;
      }
      if (result.emailSent === false && result.reason !== "email_not_configured") {
        setRequestError({ section: item.section, message: "The request was logged, but no invited participant was found.", roles: item.assignedTo || [] });
        return false;
      }
      setRequestedDocSections(prev => { const next = new Set(prev); next.add(item.section); return next; });
      return true;
    } catch (error) {
      setRequestError({ section: item.section, message: error?.message || "Request failed — try again.", roles: item.assignedTo || [] });
      return false;
    } finally {
      setRequestingDocSection(null);
    }
  }

  // ── Persist items (debounced) ──────────────────────────────────────────────
  // Reads the owner_write_token stored in localStorage by CheckoutSuccessPage.
  // The token is validated server-side; requests without a valid token receive 403.
  const persistItems = useCallback((newItems) => {
    if (!propertyId || isDemo) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSavingChecklist(true);
      try {
        let ownerToken = "";
        try { ownerToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ""; } catch { /* storage unavailable */ }
        await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/checklist`, {
          method: "PUT",
          headers: getRoomAuthHeaders(propertyId, { "Content-Type": "application/json" }),
          body: JSON.stringify({ items: newItems, ownerWriteToken: ownerToken }),
        });
      } catch { /* silent */ }
      setSavingChecklist(false);
    }, 600);
  }, [propertyId, isDemo]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  function updateItems(fn) {
    setItems(prev => {
      const next = fn(prev || []).map((i, idx) => ({ ...i, sortOrder: idx }));
      persistItems(next);
      return next;
    });
  }

  function handleSaveEdit(updated) {
    updateItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    setEditingId(null);
  }

  function handleDelete(id) {
    updateItems(prev => prev.filter(i => i.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function handleDuplicate(item) {
    const clone = { ...item, id: uid(), section: `${item.section}_copy_${Date.now().toString(36)}`, isCustom: true };
    updateItems(prev => {
      const idx = prev.findIndex(i => i.id === item.id);
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  }

  function handleMarkNotApplicable(id) {
    updateItems(prev => prev.map(i => i.id === id ? { ...i, notApplicable: !i.notApplicable } : i));
    setOpenMenuId(null);
  }

  function handleMoveUp(id) {
    updateItems(prev => {
      const idx = prev.findIndex(i => i.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function handleMoveDown(id) {
    updateItems(prev => {
      const idx = prev.findIndex(i => i.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  function handleAddSuggestions(newItems) {
    updateItems(prev => [...prev, ...newItems]);
    setDrawerOpen(false);
  }

  function handleResetToDefaults() {
    const seeded = seedFromPack(workflowPack, propertyType);
    updateItems(() => seeded);
    setConfirmReset(false);
  }

  function handleAddInline() {
    if (!addDocLabel.trim()) return;
    const newItem = {
      id: uid(),
      section: `custom_${slugify(addDocLabel)}_${Date.now().toString(36)}`,
      label: addDocLabel.trim(),
      required: false,
      ai: false,
      assignedTo: [],
      category: "General",
      isCustom: true,
      sortOrder: 9999,
      aiExtraction: null,
    };
    updateItems(prev => [...prev, newItem]);
    setAddDocLabel("");
    setAddDocOpen(false);
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  async function handleUpload(section, file, isAiEndpoint) {
    if (!file) return;
    setUploadingSection(section);
    setUploadError("");
    const form = new FormData();
    form.append("file", file);
    form.append("property_id", propertyId);
    form.append("section", section);
    form.append("role", role || "owner");
    const docEntry = (items || []).find(t => t.section === section);
    if (docEntry?.aiExtraction) {
      if (docEntry.aiExtraction.analystRole) form.append("analystRole", docEntry.aiExtraction.analystRole);
      if (docEntry.aiExtraction.docTypes) form.append("docTypes", JSON.stringify(docEntry.aiExtraction.docTypes));
      if (docEntry.aiExtraction.metrics) form.append("metricsSchema", JSON.stringify(docEntry.aiExtraction.metrics));
    }
    try {
      const endpoint = isAiEndpoint
        ? `${API_BASE}${AI_UPLOAD_ENDPOINTS[section]}`
        : `${API_BASE}/api/public/deal-room/${propertyId}/track-document`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: getRoomAuthHeaders(propertyId),
        body: form,
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          result.message
          || result.error
          || `Upload failed (${res.status})`
        );
      }
      setRefreshKey(k => k + 1);
      onAnalysisSaved?.();
    } catch (error) {
      setUploadError(error?.message || "Upload failed — try again.");
    } finally {
      setUploadingSection(null);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const uploadedSections = new Set(analyses.map(a => a.section));
  const analysisBySection = Object.fromEntries(analyses.map(a => [a.section, a.analysis]));

  // Build the template this role should see
  const schemaItems = workflowPack.getDocumentSchema?.(propertyType, jurisdiction) || [];
  const schemaItemByKey = new Map(schemaItems.flatMap(item => [
    [item.id, item], [item.section, item],
  ].filter(([key]) => key)));
  const allItems = (items || []).map(item => {
    const configured = schemaItemByKey.get(item.id) || schemaItemByKey.get(item.section);
    const assignedTo = Array.isArray(item.assignedTo) && item.assignedTo.length > 0
      ? item.assignedTo : (configured?.assignedTo || []);
    return configured ? { ...configured, ...item, assignedTo } : { ...item, assignedTo };
  });
  const normalizedRole = normalizeRoleKey(role);
  const myItems = allItems.filter(i =>
    (i.assignedTo || []).some(assignedRole => normalizeRoleKey(assignedRole) === normalizedRole)
  );
  const template = isCoordinator
    ? allItems
    : myItems;

  const requiredItems = template.filter(i => i.required);
  const doneCount = template.filter(i => uploadedSections.has(i.section)).length;
  const requiredDone = requiredItems.filter(i => uploadedSections.has(i.section)).length;
  const pct = template.length > 0 ? Math.round((doneCount / template.length) * 100) : 0;
  const allRequiredDone = requiredDone === requiredItems.length && requiredItems.length > 0;

  const allIssues = analyses.flatMap(a =>
    getCompletenessIssues(a.analysis, a.section).map(issue => ({ ...issue, section: a.section, filename: a.filename }))
  );
  const criticalIssues = allIssues.filter(i => i.sev === "Critical");

  const statusColor = allRequiredDone ? "#16a34a" : pct > 50 ? "#d97706" : "#800020";
  const statusLabel = allRequiredDone
    ? "Complete"
    : template.length === 0
      ? "Empty"
      : `${doneCount} of ${template.length} uploaded`;

  const checklistTitle = (!isCoordinator && myItems.length > 0)
    ? "Your Documents"
    : (workflowPack.checklistTitle || "Due Diligence Checklist");

  // Track which suggestion library IDs are already in the checklist.
  // Items added from the drawer carry sourceSuggestionId; items seeded from
  // the pack use their original id directly.  Using this canonical ID (not the
  // generated checklist-item uuid) ensures the drawer reliably flags previously
  // added suggestions even after the page is reloaded.
  const existingBaseIds = new Set(
    allItems.flatMap(i => [
      i.sourceSuggestionId,        // set by drawer on add
      i.id,                        // pack-seeded items use their pack id directly
    ].filter(Boolean))
  );

  // ── Item renderer ─────────────────────────────────────────────────────────
  function renderItem(item, idx, totalInGroup) {
    const done = uploadedSections.has(item.section);
    const isUploading = uploadingSection === item.section;
    const analysis = analysisBySection[item.section];
    const isPending = analysis?.pending;
    const issues = done && !isPending ? getCompletenessIssues(analysis, item.section) : [];
    const facts = done && !isPending ? getInlineFacts(analysis, item.section) : [];
    const hasIssues = issues.length > 0;
    const isItemExpanded = expandedItems[item.section];
    const isAiSection = item.ai && AI_UPLOAD_ENDPOINTS?.[item.section];
    const isEditing = editingId === item.id;
    const notApplicable = !!item.notApplicable;

    // ── Status vocabulary ────────────────────────────────────────────────
    const itemStatus = notApplicable ? "Not Applicable"
      : done ? (isPending ? "Under Review" : hasIssues ? "Needs Attention" : "Uploaded")
      : "Missing";
    const statusStyle = notApplicable
      ? { bg: "#f9fafb", color: "#9ca3af", border: "#e5e7eb" }
      : done
        ? isPending
          ? { bg: "#eff6ff", color: "#3b82f6", border: "#bfdbfe" }
          : hasIssues
            ? { bg: "#fffbeb", color: "#d97706", border: "#fde68a" }
            : { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" }
        : { bg: "#f9fafb", color: "#9ca3af", border: "#e5e7eb" };

    // Responsible party (coordinator view)
    const assignedRoleMetas = packRoles.filter(r => item.assignedTo?.includes(r.key));

    // Can the row expand?
    const canExpand = done && !isPending && (issues.length > 0 || analysis?.summary || facts.length > 0);

    return (
      <div key={item.id} className="py-2.5 group/item">
        <div className="flex items-start gap-3">
          {/* Status icon */}
          <div className="shrink-0 mt-1">
            {notApplicable ? (
              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-[10px] text-gray-400 font-bold leading-none">—</span>
              </div>
            ) : done ? (
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

          {/* Label + badges + status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm ${notApplicable ? "text-gray-400 line-through" : done ? "text-gray-900 font-medium" : "text-gray-700"}`}>
                {item.label}
              </span>
              {item.required ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-400 font-medium">required</span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">optional</span>
              )}
              {/* Status badge */}
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
                {itemStatus}
              </span>
              {item.ai && done && !isPending && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-400 font-medium">AI</span>
              )}
              {isPending && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium animate-pulse">AI analyzing…</span>
              )}
              {/* Responsible party */}
              {isCoordinator && assignedRoleMetas.map(assignedRoleMeta => (
                <span key={assignedRoleMeta.key} className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: (assignedRoleMeta.color || "#e5e7eb") + "22", color: assignedRoleMeta.color || "#6b7280" }}>
                  {assignedRoleMeta.icon || ""} {assignedRoleMeta.label}
                </span>
              ))}
            </div>

            {/* Key facts (collapsed preview — first 3) */}
            {facts.length > 0 && !isItemExpanded && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {facts.slice(0, 3).map((f, i) => {
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

            {/* Expand toggle */}
            {canExpand && (
              <button
                onClick={() => setExpandedItems(s => ({ ...s, [item.section]: !s[item.section] }))}
                className="text-[11px] text-gray-400 hover:text-gray-600 mt-1 flex items-center gap-0.5 transition">
                {isItemExpanded
                  ? "▲ Hide findings"
                  : `▼ ${hasIssues ? `${issues.length} flag${issues.length > 1 ? "s" : ""} · ` : ""}View AI findings`}
              </button>
            )}

            {/* Expanded inline findings panel */}
            {isItemExpanded && (
              <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                {/* Summary */}
                {analysis?.summary && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Summary</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{analysis.summary}</p>
                  </div>
                )}

                {/* Key information */}
                {facts.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Key information</p>
                    <div className="flex flex-wrap gap-1.5">
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
                  </div>
                )}

                {/* Issues / flags */}
                {issues.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Issues</p>
                    <div className="space-y-1">
                      {issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="text-xs shrink-0 mt-px"
                            style={{ color: issue.sev === "Critical" ? "#dc2626" : "#d97706" }}>
                            {issue.sev === "Critical" ? "⚠" : "⬥"}
                          </span>
                          <span className="text-xs leading-tight"
                            style={{ color: issue.sev === "Critical" ? "#dc2626" : "#d97706" }}>
                            {issue.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended next action */}
                {(analysis?.recommendedNextAction || analysis?.recommended_next_action) && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Recommended next action</p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {analysis.recommendedNextAction || analysis.recommended_next_action}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="shrink-0 flex items-center gap-1">
            {/* Reorder arrows — coordinator, on hover */}
            {isCoordinator && !isDemo && (() => {
              const globalIdx = allItems.findIndex(i => i.id === item.id);
              return (
                <div className="opacity-0 group-hover/item:opacity-100 transition flex flex-col gap-0.5">
                  <button disabled={globalIdx <= 0} onClick={() => handleMoveUp(item.id)}
                    title="Move up" className="block text-gray-200 hover:text-gray-500 disabled:opacity-20 leading-none text-[10px] transition">▲</button>
                  <button disabled={globalIdx < 0 || globalIdx >= allItems.length - 1} onClick={() => handleMoveDown(item.id)}
                    title="Move down" className="block text-gray-200 hover:text-gray-500 disabled:opacity-20 leading-none text-[10px] transition">▼</button>
                </div>
              );
            })()}

            {/* Upload button */}
            {!done && !isDemo && !notApplicable && (
              <>
                <input type="file" className="hidden"
                  ref={el => { fileRefs.current[item.section] = el; }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.csv"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(item.section, f, !!isAiSection); e.target.value = ""; }}
                />
                <button disabled={isUploading}
                  onClick={() => fileRefs.current[item.section]?.click()}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-40">
                  {isUploading ? "Uploading…" : "↑ Upload"}
                </button>
                {/* Task #143 — Request from participant button.
                    Shown when the doc has an assignedTo role (meaning it's
                    expected from a specific party, not the coordinator). */}
                {isCoordinator && !isDemo && (item.assignedTo?.length > 0) && (
                  requestedDocSections.has(item.section) ? (
                    <span className="text-[10px] text-green-600 font-medium px-1">✓ Requested</span>
                  ) : (
                    <button
                      disabled={requestingDocSection === item.section}
                      onClick={() => handleRequestDoc(item)}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold border border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300 transition disabled:opacity-40">
                      {requestingDocSection === item.section ? "…" : "Request →"}
                    </button>
                  )
                )}
                {requestError?.section === item.section && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-700">
                    <span>{requestError.message}</span>
                    {onPeople && (
                      <button type="button" onClick={onPeople} className="font-bold underline underline-offset-2">
                        Open People
                      </button>
                    )}
                  </span>
                )}
              </>
            )}
            {done && !isDemo && (
              <>
                <input type="file" className="hidden"
                  ref={el => { fileRefs.current[`re_${item.section}`] = el; }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.csv"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(item.section, f, !!isAiSection); e.target.value = ""; }}
                />
                <button disabled={isUploading || isPending}
                  onClick={() => fileRefs.current[`re_${item.section}`]?.click()}
                  className="px-2 py-0.5 rounded text-[10px] font-medium border border-gray-100 text-gray-300 hover:text-gray-500 hover:border-gray-200 transition disabled:opacity-30">
                  re-upload
                </button>
              </>
            )}

            {/* Coordinator action menu (⋮) */}
            {isCoordinator && !isDemo && (
              <div className="relative shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                  className="opacity-0 group-hover/item:opacity-100 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition leading-none">
                  ⋮
                </button>
                {openMenuId === item.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[170px]">
                      <button onClick={() => { setEditingId(item.id); setOpenMenuId(null); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition flex items-center gap-2">
                        <span>✏</span> Edit
                      </button>
                      <button onClick={() => { handleDuplicate(item); setOpenMenuId(null); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition flex items-center gap-2">
                        <span>⧉</span> Duplicate
                      </button>
                      <button onClick={() => handleMarkNotApplicable(item.id)}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition flex items-center gap-2">
                        <span>—</span> {item.notApplicable ? "Mark required" : "Mark not applicable"}
                      </button>
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button onClick={() => { handleDelete(item.id); setOpenMenuId(null); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition flex items-center gap-2">
                          <span>✕</span> Remove
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Inline editor */}
        {isEditing && (
          <ItemEditor
            item={item}
            roles={packRoles}
            onSave={handleSaveEdit}
            onCancel={() => setEditingId(null)}
          />
        )}
      </div>
    );
  }

  // ── Build category groups ────────────────────────────────────────────────
  function buildCategoryGroups() {
    const map = new Map();
    for (const item of allItems) {
      const cat = getItemCategory(item);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(item);
    }
    const result = [];
    for (const cat of CATEGORY_DISPLAY_ORDER) {
      if (map.has(cat)) result.push({ key: cat, label: cat, items: map.get(cat) });
    }
    // Any categories not in the predefined order
    for (const [cat, items] of map) {
      if (!CATEGORY_DISPLAY_ORDER.includes(cat)) result.push({ key: cat, label: cat, items });
    }
    return result.filter(g => g.items.length > 0);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isLoadingChecklist = items === null;

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition text-left">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-base font-bold text-gray-900">{checklistTitle}</div>
            {!isLoadingChecklist && template.length > 0 && (
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
            {savingChecklist && isCoordinator && (
              <span className="text-[10px] text-gray-400 font-medium">saving…</span>
            )}
          </div>
          <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Progress bar */}
        {!isLoadingChecklist && template.length > 0 && (
          <div className="px-5 pb-1">
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: statusColor }} />
            </div>
          </div>
        )}

        {expanded && (
          <div className="px-5 pt-3 pb-4">
            {isLoadingChecklist ? (
              <div className="text-center py-6 text-sm text-gray-400">Loading checklist…</div>
            ) : (
              <>
                 {template.length === 0 ? (
                  <div className="text-center py-8">
                     <p className="text-sm font-semibold text-gray-500 mb-1">
                       {!isCoordinator && allItems.length > 0
                         ? "No documents are currently assigned to your role"
                         : "No documents yet"}
                     </p>
                    <p className="text-xs text-gray-400">
                       {!isCoordinator && allItems.length > 0
                         ? "The deal coordinator will share any files that need your review."
                         : "Upload documents and invite participants to begin tracking your transaction."}
                    </p>
                  </div>
                ) : isCoordinator ? (
                  /* ── Coordinator: Core / Additional split ──────────────── */
                  <CoordinatorDocumentGroups
                    template={template}
                    allItems={allItems}
                    uploadedSections={uploadedSections}
                    buildCategoryGroups={buildCategoryGroups}
                    renderItem={renderItem}
                  />
                ) : (
                  /* ── Party or reviewer view ───────────────────────────── */
                  <div className="divide-y divide-gray-50">
                    {template.map((item, idx) => renderItem(item, idx, template.length))}
                  </div>
                )}

                {/* ── Footer: coordinator controls ──────────────────────── */}
                {!isDemo && isCoordinator && (
                  <div className="pt-3 mt-1 border-t border-gray-100 space-y-2">
                    {addDocOpen ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Document name (e.g. Environmental Indemnity)"
                          value={addDocLabel}
                          onChange={e => setAddDocLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") handleAddInline();
                            if (e.key === "Escape") { setAddDocOpen(false); setAddDocLabel(""); }
                          }}
                          className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
                        />
                        <button onClick={handleAddInline} disabled={!addDocLabel.trim()}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition disabled:opacity-40"
                          style={{ background: "#800020" }}>
                          Add
                        </button>
                        <button onClick={() => { setAddDocOpen(false); setAddDocLabel(""); }}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] text-gray-400 hover:text-gray-600 border border-gray-200 transition">
                          Cancel
                        </button>
                      </div>
                    ) : confirmReset ? (
                      <div className="flex flex-col gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs font-semibold text-amber-800">
                          Restore the original template checklist for this transaction type?
                        </p>
                        <p className="text-[11px] text-amber-600">
                          Custom items you've added will be removed. Template items will be restored. Uploaded documents are not affected.
                        </p>
                        <div className="flex gap-2">
                          <button onClick={handleResetToDefaults}
                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition"
                            style={{ background: "#800020" }}>
                            Yes, restore template
                          </button>
                          <button onClick={() => setConfirmReset(false)}
                            className="px-3 py-1.5 rounded-lg text-[11px] text-gray-500 hover:text-gray-700 border border-gray-200 transition">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 flex-wrap">
                        <button onClick={() => setAddDocOpen(true)}
                          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition group">
                          <span className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300 group-hover:border-gray-400 flex items-center justify-center text-[10px] leading-none">+</span>
                          Add a document
                        </button>
                        <button onClick={() => setDrawerOpen(true)}
                          className="flex items-center gap-2 text-xs text-[#800020]/70 hover:text-[#800020] transition group font-medium">
                          <span className="text-sm">📚</span>
                          Browse suggested items
                        </button>
                        <button onClick={() => setConfirmReset(true)}
                          className="flex items-center gap-2 text-xs text-gray-300 hover:text-gray-500 transition group ml-auto">
                          <span className="text-sm">↺</span>
                          Restore template items
                        </button>
                      </div>
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

                {allRequiredDone && criticalIssues.length === 0 && template.length > 0 && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2">
                    <span className="text-lg">✅</span>
                    <div>
                      <p className="text-xs font-bold text-green-700">All required documents uploaded</p>
                      <p className="text-xs text-green-600">No critical issues flagged by AI. This deal room is ready for final review.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Suggestion drawer (portal-free, fixed-position overlay) */}
      <SuggestionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAdd={handleAddSuggestions}
        existingIds={existingBaseIds}
      />
    </>
  );
}
