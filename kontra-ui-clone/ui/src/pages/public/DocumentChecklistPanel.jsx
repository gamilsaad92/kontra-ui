import { useState, useEffect, useRef, useCallback } from "react";
import { getWorkflowPack, DEFAULT_PACK_ID } from "../../lib/workflowPacks";
import { getRoomAuthHeaders } from "../../lib/inviteUtils";
import { API_BASE } from "../../lib/apiBase";

const normalizeRoleKey = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "_");

// ── helpers ──────────────────────────────────────────────────────────────────
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
function uid() {
  return `ci_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Category grouping ─────────────────────────────────────────────────────────
// Maps known section keys → display category.  Items that already carry a
// category field (from the pack schema or a previously-saved checklist) use
// that value directly; unknown sections fall back to "General".
const SECTION_TO_CATEGORY = {
  // Financial
  financials: "Financial", audited_financials: "Financial",
  tax_returns: "Financial", qoe: "Financial",
  rent_roll: "Financial", cap_table: "Financial",
  // Legal
  legal: "Legal", title: "Legal", loi: "Legal",
  purchase_agreement: "Legal", spa: "Legal",
  disclosure_schedule: "Legal", estoppel: "Legal",
  contracts: "Legal", term_sheet: "Legal",
  // Operational
  environmental: "Operational",
  // Property / Asset
  inspection: "Property / Asset", survey: "Property / Asset",
  // Insurance
  insurance: "Insurance",
  // Closing
  "brand-standards": "Closing",
  // Regulatory (jurisdiction-specific tokenization docs)
  fsra_licence: "Regulatory", dfsa_promotion_approval: "Regulatory",
  mica_white_paper: "Regulatory", national_authority_receipt: "Regulatory",
  form_d: "Regulatory", accredited_verification: "Regulatory",
  mas_prospectus_or_exemption: "Regulatory", mas_ps_licence: "Regulatory",
  fca_promotion_approval: "Regulatory", fca_aml_registration: "Regulatory",
};

const CATEGORY_DISPLAY_ORDER = [
  "Financial", "Legal", "Operational",
  "Property / Asset", "Insurance", "Regulatory", "Closing", "General",
];

function getItemCategory(item) {
  if (item.category && item.category !== "General") return item.category;
  return SECTION_TO_CATEGORY[item.section] || "General";
}

// Seed the checklist from the pack's document schema when the workspace has no
// persisted items yet. Passes jurisdiction as second arg so tokenization packs
// can merge in jurisdiction-specific required documents.
function seedFromPack(pack, propertyType, jurisdiction) {
  const schema = pack.getDocumentSchema?.(propertyType, jurisdiction) || [];
  return schema.map((d, i) => ({
    id: d.id || d.section || uid(),
    section: d.section || d.id,
    label: d.label || "",
    required: !!d.required,
    ai: !!d.ai,
    assignedTo: Array.isArray(d.assignedTo) ? d.assignedTo : [],
    category: d.category || "General",
    isCustom: false,
    sortOrder: i,
    aiExtraction: d.aiExtraction || null,
  }));
}

// ── SuggestionDrawer ─────────────────────────────────────────────────────────
const CATEGORY_ORDER = [
  "Corporate & Ownership", "Financial", "Legal", "Tax", "Operations",
  "Employees", "Insurance", "Intellectual Property", "Regulatory",
  "Environmental", "Real Estate", "Financing", "Closing",
];

function SuggestionDrawer({ open, onClose, onAdd, existingIds }) {
  const [allSuggestions, setAllSuggestions] = useState([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [customName, setCustomName] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) { setSelected(new Set()); setQuery(""); setCustomName(""); setShowCustom(false); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/suggestions`)
      .then(r => r.ok ? r.json() : { suggestions: [] })
      .then(d => setAllSuggestions(d.suggestions || []))
      .catch(() => {})
      .finally(() => { setLoading(false); setTimeout(() => inputRef.current?.focus(), 50); });
  }, [open]);

  const categories = ["All", ...CATEGORY_ORDER.filter(c => allSuggestions.some(s => s.category === c))];

  const filtered = allSuggestions.filter(s => {
    const matchesCat = activeCategory === "All" || s.category === activeCategory;
    const matchesQ = !query.trim() || s.label.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQ;
  });

  const alreadyAdded = id => existingIds.has(id);

  function toggle(id) {
    if (alreadyAdded(id)) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAdd() {
    const newItems = allSuggestions
      .filter(s => selected.has(s.id))
      .map(s => ({
        id: uid(),
        // Track which suggestion this came from so the drawer can reliably
        // detect "already added" across sessions without comparing generated ids.
        sourceSuggestionId: s.id,
        section: `${s.id}_${Date.now().toString(36)}`,
        label: s.label,
        required: false,
        ai: !!s.ai,
        assignedTo: [],
        category: s.category,
        isCustom: true,
        sortOrder: 9999,
        aiExtraction: null,
      }));
    if (newItems.length) onAdd(newItems);
    onClose();
  }

  function handleAddCustom() {
    if (!customName.trim()) return;
    onAdd([{
      id: uid(),
      section: `custom_${slugify(customName)}_${Date.now().toString(36)}`,
      label: customName.trim(),
      required: false,
      ai: false,
      assignedTo: [],
      category: "General",
      isCustom: true,
      sortOrder: 9999,
      aiExtraction: null,
    }]);
    setCustomName("");
    setShowCustom(false);
    onClose();
  }

  if (!open) return null;

  // Group filtered items by category for display
  const grouped = {};
  for (const s of filtered) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }
  const groupKeys = CATEGORY_ORDER.filter(c => grouped[c]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative ml-auto w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Browse Suggested Items</h3>
              <p className="text-xs text-gray-400 mt-0.5">Items are suggestions only — you decide what's relevant.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search documents…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
          />

          {/* Category pills */}
          <div className="flex gap-1.5 overflow-x-auto py-2 mt-1 hide-scrollbar">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                  activeCategory === c
                    ? "text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
                style={activeCategory === c ? { background: "#800020" } : {}}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading suggestions…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No items match your search.</p>
          ) : (
            <div className="space-y-5">
              {groupKeys.map(cat => (
                <div key={cat}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{cat}</p>
                  <div className="space-y-1">
                    {grouped[cat].map(s => {
                      const isAdded = alreadyAdded(s.id);
                      const isChecked = selected.has(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggle(s.id)}
                          disabled={isAdded}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                            isAdded
                              ? "opacity-40 cursor-default"
                              : isChecked
                                ? "bg-[#800020]/8 border border-[#800020]/20"
                                : "hover:bg-gray-50 border border-transparent"
                          }`}>
                          {/* Checkbox */}
                          <span className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition ${
                            isChecked ? "border-[#800020] bg-[#800020]" : "border-gray-300"
                          }`}>
                            {isChecked && (
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="text-sm text-gray-800">{s.label}</span>
                          </span>
                          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            s.tag === "commonly_requested"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-gray-100 text-gray-400"
                          }`}>
                            {s.tag === "commonly_requested" ? "common" : "suggested"}
                          </span>
                          {s.ai && (
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium">AI</span>
                          )}
                          {isAdded && <span className="shrink-0 text-[10px] text-gray-400">added</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create custom item shortcut */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            {showCustom ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Document name…"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleAddCustom();
                    if (e.key === "Escape") { setShowCustom(false); setCustomName(""); }
                  }}
                  className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20"
                />
                <button onClick={handleAddCustom} disabled={!customName.trim()}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white disabled:opacity-40 transition"
                  style={{ background: "#800020" }}>Add</button>
                <button onClick={() => { setShowCustom(false); setCustomName(""); }}
                  className="px-2 py-1.5 rounded-lg text-[11px] text-gray-400 hover:text-gray-600 border border-gray-200 transition">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowCustom(true)}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition group">
                <span className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300 group-hover:border-gray-400 flex items-center justify-center text-[10px]">+</span>
                Create a custom item instead
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        {selected.size > 0 && (
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
            <button
              onClick={handleAdd}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition"
              style={{ background: "#800020" }}>
              Add {selected.size} item{selected.size !== 1 ? "s" : ""} to checklist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ItemEditor (inline edit form) ─────────────────────────────────────────────
function ItemEditor({ item, roles, onSave, onCancel }) {
  const [label, setLabel] = useState(item.label);
  const [required, setRequired] = useState(item.required);
  const [ai, setAi] = useState(item.ai);
  const [assignedRole, setAssignedRole] = useState((item.assignedTo || [])[0] || "");

  function handleSave() {
    if (!label.trim()) return;
    onSave({
      ...item,
      label: label.trim(),
      required,
      ai,
      assignedTo: assignedRole ? [assignedRole] : [],
    });
  }

  const inputCls = "text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40";
  const toggleCls = (on) =>
    `relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${on ? "" : "bg-gray-200"}`;

  return (
    <div className="mt-2 ml-8 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
      {/* Name */}
      <div>
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Name</label>
        <input
          autoFocus
          className={`w-full ${inputCls}`}
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
          placeholder="Document name"
        />
      </div>

      {/* Toggles row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Required toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <button
            type="button"
            onClick={() => setRequired(v => !v)}
            className={toggleCls(required)}
            style={required ? { background: "#800020" } : {}}>
            <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${required ? "translate-x-3.5" : "translate-x-0.5"}`} />
          </button>
          <span className="text-xs text-gray-600">Required</span>
        </label>

        {/* AI analysis toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <button
            type="button"
            onClick={() => setAi(v => !v)}
            className={toggleCls(ai)}
            style={ai ? { background: "#3b82f6" } : {}}>
            <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${ai ? "translate-x-3.5" : "translate-x-0.5"}`} />
          </button>
          <span className="text-xs text-gray-600">AI analysis</span>
        </label>
      </div>

      {/* Role assignment */}
      {roles.length > 0 && (
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Assigned to</label>
          <select
            className={`w-full ${inputCls} bg-white`}
            value={assignedRole}
            onChange={e => setAssignedRole(e.target.value)}>
            <option value="">— unassigned —</option>
            {roles.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!label.trim()}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white disabled:opacity-40 transition"
          style={{ background: "#800020" }}>
          Save
        </button>
        <button onClick={onCancel}
          className="px-2.5 py-1.5 rounded-lg text-[11px] text-gray-400 hover:text-gray-600 border border-gray-200 transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── CoordinatorDocumentGroups ─────────────────────────────────────────────────
// Splits the checklist into Core (required) and Additional (optional).
// Additional documents are collapsed by default — the user reveals them on
// demand once the room feels useful after the first meaningful upload.
function CoordinatorDocumentGroups({ template, allItems, uploadedSections, buildCategoryGroups, renderItem }) {
  const [showAdditional, setShowAdditional] = useState(false);

  const coreItems       = template.filter(i => i.required && !i.notApplicable);
  const additionalItems = template.filter(i => !i.required && !i.notApplicable);
  const naItems         = template.filter(i => i.notApplicable);

  const coreDone       = coreItems.filter(i => uploadedSections.has(i.section)).length;
  const additionalDone = additionalItems.filter(i => uploadedSections.has(i.section)).length;

  // Build category map so additional items still group by category
  const allGroups = buildCategoryGroups();
  function filterGroups(filterFn) {
    return allGroups
      .map(g => ({ ...g, items: g.items.filter(filterFn) }))
      .filter(g => g.items.length > 0);
  }

  const coreGroups       = filterGroups(i => i.required && !i.notApplicable);
  const additionalGroups = filterGroups(i => !i.required && !i.notApplicable);

  function renderGroup(group) {
    const groupDone  = group.items.filter(i => uploadedSections.has(i.section)).length;
    const groupTotal = group.items.length;
    return (
      <div key={group.key}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{group.label}</span>
          <span className="text-[10px] text-gray-400 font-medium">{groupDone}/{groupTotal} uploaded</span>
        </div>
        <div className="divide-y divide-gray-50">
          {group.items.map((item, idx) => renderItem(item, idx, group.items.length))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Core documents ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Core documents</span>
            <span className="text-[10px] text-gray-400 font-medium">
              {coreDone} of {coreItems.length} uploaded
            </span>
          </div>
        </div>
        {coreItems.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No required documents defined for this transaction type.</p>
        ) : (
          <div className="space-y-4">
            {coreGroups.map(renderGroup)}
          </div>
        )}
      </div>

      {/* ── Additional documents ───────────────────────────────────────── */}
      {additionalItems.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowAdditional(v => !v)}
            className="flex items-center gap-2 w-full text-left group">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Additional documents
            </span>
            <span className="text-[10px] text-gray-400 font-medium">
              {additionalDone} of {additionalItems.length} uploaded
            </span>
            <svg
              className={`ml-auto w-3.5 h-3.5 text-gray-300 transition-transform ${showAdditional ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!showAdditional && (
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
  requestTarget, onRequestTargetHandled,
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
  const [checklistError, setChecklistError] = useState("");
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
  const [focusedRequestSection, setFocusedRequestSection] = useState(null);
  const [documentAction, setDocumentAction] = useState(null);
  const [documentActionError, setDocumentActionError] = useState(null);

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

  // Overview action links can land here after this panel mounts. Focus the
  // matching checklist row so the coordinator sees the real request control
  // instead of only arriving at the Documents tab.
  useEffect(() => {
    if (!requestTarget || !Array.isArray(items) || items.length === 0) return;
    const query = String(requestTarget.query || requestTarget.label || '').trim().toLowerCase();
    const targetSection = String(requestTarget.section || '').trim().toLowerCase();
    const targetItemId = String(
      requestTarget.itemId || requestTarget.id || requestTarget.document_id || requestTarget.documentId || '',
    ).trim();
    const normalize = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
    const normalizedQuery = normalize(query);
    const queryTerms = normalizedQuery
      .split(' ')
      .filter(term => term.length > 2)
      .filter(term => !new Set([
        'request', 'requested', 'upload', 'uploaded', 'provide', 'obtain',
        'collect', 'missing', 'needed', 'required', 'review', 'open',
        'document', 'documents', 'file', 'files', 'please',
      ]).has(term));
    const match = items.find(item => {
      if (targetItemId && String(item.id || '').trim() === targetItemId) return true;
      const section = String(item.section || '').trim().toLowerCase();
      if (targetSection && section === targetSection) return true;
      const label = normalize(item.label || item.name);
      return normalizedQuery && (
        label.includes(normalizedQuery)
        || normalizedQuery.includes(label)
        || (queryTerms.length > 0 && queryTerms.every(term => label.includes(term)))
      );
    });
    if (!match) return;
    setFocusedRequestSection(match.section);
    setExpandedItems(previous => ({ ...previous, [match.section]: true }));
    if (requestTarget.autoRequest && !requestedDocSections.has(match.section)) {
      void handleRequestDoc(match);
    }
    const timer = window.setTimeout(() => {
      [...document.querySelectorAll('[data-document-section]')]
        .find(element => element.dataset.documentSection === match.section)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    onRequestTargetHandled?.();
    return () => window.clearTimeout(timer);
  }, [items, onRequestTargetHandled, requestTarget, requestedDocSections]);

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
      setChecklistError("");
      try {
        let ownerToken = "";
        try { ownerToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ""; } catch { /* storage unavailable */ }
        const response = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/checklist`, {
          method: "PUT",
          headers: getRoomAuthHeaders(propertyId, { "Content-Type": "application/json" }),
          body: JSON.stringify({ items: newItems, ownerWriteToken: ownerToken }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || result.error || "Checklist changes could not be saved.");
      } catch (error) {
        setChecklistError(error.message || "Checklist changes could not be saved.");
      } finally {
        setSavingChecklist(false);
      }
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
        ? `${API_BASE}${AI_UPLOAD_ENDPOINTS?.[section] || "/api/ai/analyze-document"}`
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
      // AI routes acknowledge the upload before their background persistence
      // finishes. Rehydrate a few times so the checklist cannot stay at
      // "Missing" after a successful upload.
      [500, 1500, 3000].forEach(delay => {
        window.setTimeout(() => {
          setRefreshKey(k => k + 1);
          onAnalysisSaved?.();
        }, delay);
      });
    } catch (error) {
      setUploadError(error?.message || "Upload failed — try again.");
    } finally {
      setUploadingSection(null);
    }
  }

  async function handleOriginalDocumentAction(analysisRecord, action) {
    if (!propertyId || !analysisRecord?.id) return;
    const actionKey = `${analysisRecord.id}:${action}`;
    setDocumentAction(actionKey);
    setDocumentActionError(null);
    const popup = action === "view" ? window.open("about:blank", "_blank") : null;
    try {
      const response = await fetch(
        `${API_BASE}/api/public/deal-room/${encodeURIComponent(propertyId)}/document/${encodeURIComponent(analysisRecord.id)}/url${action === "download" ? "?download=1" : ""}`,
        { headers: getRoomAuthHeaders(propertyId) },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) {
        throw new Error(result.error || "The original document is not available.");
      }

      if (action === "view") {
        if (popup) {
          popup.opener = null;
          popup.location.href = result.url;
        } else {
          window.open(result.url, "_blank", "noopener,noreferrer");
        }
      } else {
        const link = document.createElement("a");
        link.href = result.url;
        link.download = result.filename || analysisRecord.filename || "original-document";
        link.rel = "noopener";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      popup?.close();
      setDocumentActionError({
        id: analysisRecord.id,
        message: error?.message || "The original document is not available.",
      });
    } finally {
      setDocumentAction(null);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const uploadedSections = new Set(analyses.map(a => a.section));
  const analysisBySection = Object.fromEntries(analyses.map(a => [a.section, a.analysis]));
  const analysisRecordBySection = Object.fromEntries(analyses.map(a => [a.section, a]));

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
    const analysisRecord = analysisRecordBySection[item.section];
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
      <div
        key={item.id}
        data-document-section={item.section}
        className={`py-2.5 group/item transition-colors ${focusedRequestSection === item.section ? "rounded-lg bg-amber-50/70 px-2 -mx-2 ring-1 ring-amber-200" : ""}`}>
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
                {analysisRecord?.id && analysisRecord?.storage_path && !isPending && (
                  <>
                    <button
                      type="button"
                      disabled={documentAction === `${analysisRecord.id}:view`}
                      onClick={() => handleOriginalDocumentAction(analysisRecord, "view")}
                      className="px-2 py-0.5 rounded text-[10px] font-medium border border-gray-100 text-gray-400 hover:text-gray-600 hover:border-gray-200 transition disabled:opacity-40"
                      title="Open the stored original document">
                      {documentAction === `${analysisRecord.id}:view` ? "…" : "View original"}
                    </button>
                    <button
                      type="button"
                      disabled={documentAction === `${analysisRecord.id}:download`}
                      onClick={() => handleOriginalDocumentAction(analysisRecord, "download")}
                      className="px-2 py-0.5 rounded text-[10px] font-medium border border-gray-100 text-gray-400 hover:text-gray-600 hover:border-gray-200 transition disabled:opacity-40"
                      title="Download the stored original document">
                      {documentAction === `${analysisRecord.id}:download` ? "…" : "Download original"}
                    </button>
                    {documentActionError?.id === analysisRecord.id && (
                      <span className="text-[10px] text-red-600" role="alert">
                        {documentActionError.message}
                      </span>
                    )}
                  </>
                )}
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
            {checklistError && isCoordinator && (
              <span className="text-[10px] text-red-600 font-semibold">{checklistError}</span>
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
