import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PublicLayout from "./PublicLayout";
import { trackEvent } from "../../lib/analytics";
import { listWorkflowPacks, fetchCustomPacks, getWorkflowPack, deleteCustomPack, registerCustomPack } from "../../lib/workflowPacks";
import { API_BASE } from "../../lib/apiBase";

const ICON_CHOICES = ["📄","🏢","💼","🏦","🔍","🛡️","⚖️","📊","⚙️","🏗️","🧾","📋","🤝","🏭","👤","🔑","✍️","📝","🌐","🏛️"];
const COLOR_CHOICES = ["#800020","#1d4ed8","#16a34a","#d97706","#6d28d9","#0369a1","#374151","#dc2626","#0891b2","#7c3aed"];

const SYSTEM_PACK_IDS = ["business_acquisition", "cre_acquisition", "fundraising", "tokenization"];

// Transaction types where Digital Asset Preparation is contextually relevant.
// For everything else it stays hidden unless the user explicitly enables it.
const TOKENIZATION_RELEVANT_TYPES = new Set([
  'tokenization', 'token_issuance', 'sto', 'security_token', 'digital_asset', 'rwa',
]);

// Map the AI transaction-type hint to the matching system pack ID.
// Used to keep the preview pack, the Review summary, and the activated workspace in sync.
const AI_TYPE_TO_PACK = {
  business_acquisition: "business_acquisition",
  cre_acquisition:      "cre_acquisition",
  fundraising:          "fundraising",
  tokenization:         "tokenization",
  token_issuance:       "tokenization",
  // All other types (lending, licensing, joint_venture, other) default to business_acquisition
  // as the most generic structural starting point.
};

const AI_TYPE_LABELS = {
  business_acquisition: "Business Acquisition",
  cre_acquisition: "Commercial Real Estate Acquisition",
  fundraising: "Fundraising Round",
  tokenization: "Token Issuance / STO",
  lending: "Lending / Finance",
  licensing: "Licensing Transaction",
  joint_venture: "Joint Venture",
  other: "Custom Transaction",
};

function slugKey(s) {
  return String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

function configFromPack(pack) {
  if (!pack) return { roles: [], documents: [], stages: [] };
  return {
    roles: (pack.roles || []).map((r, i) => ({
      key: r.key || slugKey(r.label),
      label: r.label || "",
      icon: r.icon || "👤",
      color: r.color || "#800020",
      required: !!r.required,
      needsDocs: !!r.needsDocs,
      invitable: r.invitable !== false,
      canManage: r.canManage !== undefined ? !!r.canManage : i === 0,
    })),
    documents: (pack.documentSchema || pack.documents || []).map(d => ({
      id: d.id || slugKey(d.label),
      label: d.label || "",
      required: !!d.required,
      ai: !!d.ai,
      assignedRole: Array.isArray(d.assignedTo) ? d.assignedTo[0] : (d.assignedRole || ""),
    })),
    stages: (pack.stages || []).map(s => ({
      key: s.key || slugKey(s.label),
      label: s.label || "",
    })),
  };
}

// ── Inline editable text ──────────────────────────────────────────────────────
function InlineEdit({ value, onChange, placeholder, className }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`border-b border-transparent hover:border-gray-300 focus:border-red-800 focus:outline-none bg-transparent text-sm transition-colors ${className || ""}`}
    />
  );
}

// ── Collapsible section for preview step ─────────────────────────────────────
function CollapsedSection({ title, count, icon, description, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">{icon}</span>
          <div>
            <span className="text-sm font-semibold text-gray-900">{title}</span>
            {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{count}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Inline role/doc/stage editors (shared with preview accordions) ────────────
function RolesEditor({ roles, onChange }) {
  const addRole = () => onChange([...roles, { key: "", label: "New Role", required: false, needsDocs: true, invitable: true, icon: ICON_CHOICES[roles.length % ICON_CHOICES.length], color: COLOR_CHOICES[roles.length % COLOR_CHOICES.length] }]);
  const updateRole = (i, patch) => onChange(roles.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeRole = i => onChange(roles.filter((_, idx) => idx !== i));

  const Badge = ({ on, onToggle, label }) => (
    <button type="button" onClick={onToggle}
      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors select-none ${on ? "text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
      style={on ? { background: "#800020" } : {}}>
      {label}
    </button>
  );

  return (
    <div className="space-y-0">
      {roles.length === 0 && <p className="text-xs text-gray-400 italic py-2">No participants yet. Add a role to get started.</p>}
      {roles.map((r, i) => (
        <div key={i} className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0 group">
          <span className="text-base w-5 shrink-0 text-center">{r.icon}</span>
          <InlineEdit value={r.label} onChange={v => updateRole(i, { label: v, key: slugKey(v) })} placeholder="Role name" className="flex-1 min-w-0" />
          <Badge on={r.required} onToggle={() => updateRole(i, { required: !r.required })} label="Required" />
          <Badge on={r.needsDocs} onToggle={() => updateRole(i, { needsDocs: !r.needsDocs })} label="Uploads" />
          {roles.length > 1 && (
            <button type="button" onClick={() => removeRole(i)} className="shrink-0 text-gray-300 hover:text-red-500 transition-colors text-xs ml-1 opacity-0 group-hover:opacity-100">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={addRole} className="mt-2 text-xs font-semibold text-red-800 hover:underline">+ Add role</button>
    </div>
  );
}

function DocumentsEditor({ documents, roles, onChange }) {
  const addDoc = () => onChange([...documents, { id: "", label: "New Document", required: false, ai: false, assignedRole: "" }]);
  const updateDoc = (i, patch) => onChange(documents.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  const removeDoc = i => onChange(documents.filter((_, idx) => idx !== i));

  const Badge = ({ on, onToggle, label }) => (
    <button type="button" onClick={onToggle}
      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors select-none ${on ? "text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
      style={on ? { background: "#800020" } : {}}>
      {label}
    </button>
  );

  return (
    <div className="space-y-0">
      {documents.length === 0 && <p className="text-xs text-gray-400 italic py-2">No documents yet.</p>}
      {documents.map((d, i) => (
        <div key={i} className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0 group">
          <span className="text-sm shrink-0 text-gray-400">📄</span>
          <InlineEdit value={d.label} onChange={v => updateDoc(i, { label: v, id: slugKey(v) })} placeholder="Document name" className="flex-1 min-w-0" />
          {roles.length > 0 && (
            <select value={d.assignedRole || ""} onChange={e => updateDoc(i, { assignedRole: e.target.value })}
              className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-500 shrink-0 max-w-[80px]">
              <option value="">Any</option>
              {roles.filter(r => r.label).map((r, ri) => <option key={ri} value={r.key}>{r.label}</option>)}
            </select>
          )}
          <Badge on={d.required} onToggle={() => updateDoc(i, { required: !d.required })} label="Required" />
          <Badge on={d.ai} onToggle={() => updateDoc(i, { ai: !d.ai })} label="AI" />
          <button type="button" onClick={() => removeDoc(i)} className="shrink-0 text-gray-300 hover:text-red-500 transition-colors text-xs ml-1 opacity-0 group-hover:opacity-100">✕</button>
        </div>
      ))}
      <button type="button" onClick={addDoc} className="mt-2 text-xs font-semibold text-red-800 hover:underline">+ Add document</button>
    </div>
  );
}

function StagesEditor({ stages, onChange }) {
  const addStage = () => onChange([...stages, { key: "", label: "New Stage" }]);
  const updateStage = (i, patch) => onChange(stages.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const removeStage = i => onChange(stages.filter((_, idx) => idx !== i));
  const moveStage = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= stages.length) return;
    const arr = [...stages];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  };

  return (
    <div className="space-y-0">
      {stages.length < 2 && <p className="text-xs text-amber-600 italic mb-2">At least 2 stages are required.</p>}
      {stages.map((s, i) => (
        <div key={i} className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0 group">
          <span className="text-xs text-gray-400 w-4 shrink-0 font-mono text-center">{i + 1}</span>
          <InlineEdit value={s.label} onChange={v => updateStage(i, { label: v, key: slugKey(v) })} placeholder="Stage name" className="flex-1 min-w-0" />
          <div className="flex gap-0.5 shrink-0">
            <button type="button" onClick={() => moveStage(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs px-1 leading-none">↑</button>
            <button type="button" onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs px-1 leading-none">↓</button>
          </div>
          {stages.length > 2 && (
            <button type="button" onClick={() => removeStage(i)} className="shrink-0 text-gray-300 hover:text-red-500 transition-colors text-xs ml-1 opacity-0 group-hover:opacity-100">✕</button>
          )}
        </div>
      ))}
      <button type="button" onClick={addStage} className="mt-2 text-xs font-semibold text-red-800 hover:underline">+ Add stage</button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CreateDealRoomPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 0 = describe, 1 = preview, 2 = your info, 3 = activate
  const [phase, setPhase] = useState(0);
  // 'ai' | 'template' | 'blank'
  const [creationMode, setCreationMode] = useState("ai");
  // When true inside phase 0, show the template picker instead of the description input
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // Packs
  const [workflowPacks, setWorkflowPacks] = useState(() => listWorkflowPacks());
  const [deletingPackId, setDeletingPackId] = useState(null);
  useEffect(() => { fetchCustomPacks().then(() => setWorkflowPacks(listWorkflowPacks())); }, []);

  // Pre-select a template when the page is opened with ?template=<packId>
  // (e.g. from /for/business-brokers CTA → /create-deal-room?template=business_acquisition)
  useEffect(() => {
    const templateParam = searchParams.get("template");
    const validPacks = ["business_acquisition", "cre_acquisition", "fundraising", "tokenization"];
    if (templateParam && validPacks.includes(templateParam)) {
      setCreationMode("template");
      setShowTemplatePicker(true);
      set("packId", templateParam);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDeletePack(e, packId) {
    e.stopPropagation();
    if (!window.confirm("Remove this saved template? This cannot be undone.")) return;
    setDeletingPackId(packId);
    try {
      await deleteCustomPack(packId);
      setWorkflowPacks(listWorkflowPacks());
      if (form.packId === packId) set("packId", "business_acquisition");
    } catch (err) {
      alert(err.message || "Failed to delete pack");
    } finally {
      setDeletingPackId(null);
    }
  }

  function handleRenamePack(e, pack) {
    e.stopPropagation();
    const newName = window.prompt("Rename this template:", pack.label);
    if (!newName || newName.trim() === pack.label) return;
    // Update the pack name in local registry
    const updated = { ...pack, name: newName.trim(), label: newName.trim() };
    registerCustomPack({ id: pack.id, ...updated, name: newName.trim() });
    setWorkflowPacks(listWorkflowPacks());
  }

  function handleDuplicatePack(e, pack) {
    e.stopPropagation();
    const newId = pack.id + "_copy_" + Date.now().toString(36).slice(-4);
    const newName = (pack.label || pack.name || "Template") + " (copy)";
    const basePack = getWorkflowPack(pack.id);
    const config = configFromPack(basePack);
    registerCustomPack({
      id: newId,
      name: newName,
      description: pack.description || "",
      roles: config.roles,
      stages: config.stages,
      documents: config.documents,
    });
    setWorkflowPacks(listWorkflowPacks());
    set("packId", newId);
  }

  // Form state
  const [form, setForm] = useState({
    packId: "business_acquisition",
    workspaceName: "",
    workspaceLocation: "",
    dealAmount: "",
    closingDate: "",
    jurisdiction: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "owner",
    agree: false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // AI description fields
  const [aiDescription, setAiDescription] = useState("");
  const [aiTransactionType, setAiTransactionType] = useState("");
  const [aiCurrentStage, setAiCurrentStage] = useState("");

  // Customization config (roles/docs/stages)
  const [customConfig, setCustomConfig] = useState({ roles: [], documents: [], stages: [] });
  const setRoles = roles => setCustomConfig(c => ({ ...c, roles }));
  const setDocuments = documents => setCustomConfig(c => ({ ...c, documents }));
  const setStages = stages => setCustomConfig(c => ({ ...c, stages }));

  // AI generation
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [isAiGenerated, setIsAiGenerated] = useState(false);

  // Launch
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Derived ───────────────────────────────────────────────────────────────
  const activePack = workflowPacks.find(p => p.id === form.packId) || workflowPacks[0];
  const systemPacks = workflowPacks.filter(p => SYSTEM_PACK_IDS.includes(p.id));
  const savedPacks = workflowPacks.filter(p => !SYSTEM_PACK_IDS.includes(p.id));
  const jurisdictionRelevant = form.packId === "tokenization"
    || activePack?.transactionType === "tokenization"
    || aiTransactionType === "tokenization";

  // Step labels depend on mode — blank skips preview
  const steps = creationMode === "blank"
    ? ["Describe", "Your Info", "Activate"]
    : ["Describe", "Preview", "Your Info", "Activate"];

  // Map phase (0-3) to step index for the indicator
  function phaseToStepIdx(p) {
    if (creationMode === "blank") {
      // phase 0 → step 0, phase 2 → step 1, phase 3 → step 2
      if (p === 0) return 0;
      if (p === 2) return 1;
      return 2;
    }
    return p; // phase 0→0, 1→1, 2→2, 3→3
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  // ── Analytics ─────────────────────────────────────────────────────────────
  // Track phase-0 on mount (creation page opened)
  useEffect(() => {
    trackEvent("workspace_creation_phase", { phase: 0, mode: creationMode });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track abandonment: fire when the tab/window closes while still mid-flow
  useEffect(() => {
    function onUnload() {
      if (phase < 3) {
        // sendBeacon is more reliable than fetch on unload
        const body = JSON.stringify({
          session_id: (() => { try { return sessionStorage.getItem("kontra_session_id") || "anon"; } catch { return "anon"; } })(),
          event_name: "workspace_creation_abandoned",
          properties: { phase, mode: creationMode },
        });
        try { navigator.sendBeacon(`${API_BASE}/api/track`, new Blob([body], { type: "application/json" })); } catch { /* no-op */ }
      }
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [phase, creationMode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function goNext() {
    setError("");

    // Phase 0: generate or advance
    if (phase === 0) {
      if (creationMode === "blank") {
        trackEvent("workspace_creation_phase", { phase: 2, mode: "blank" });
        setPhase(2); // skip preview for blank
        return;
      }

      if (showTemplatePicker) {
        // Load template config and advance to preview
        const pack = getWorkflowPack(form.packId);
        const config = configFromPack(pack);
        setCustomConfig(config);
        setIsAiGenerated(false);
        const coord = config.roles.find(r => r.canManage) || config.roles[0];
        if (coord) set("role", coord.key);
        setShowTemplatePicker(false);
        trackEvent("workspace_creation_phase", { phase: 1, mode: "template", pack_id: form.packId });
        setPhase(1);
        return;
      }

      // AI mode — trigger generation
      if (!aiDescription.trim() || aiDescription.trim().length <= 10) return;
      setAiLoading(true);
      setAiError("");
      trackEvent("workspace_creation_ai_generate", { description_length: aiDescription.trim().length });
      try {
        const body = { description: aiDescription };
        if (aiTransactionType) body.transactionType = aiTransactionType;
        if (aiCurrentStage) body.currentStage = aiCurrentStage;
        const res = await fetch(`${API_BASE}/api/workspace/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "AI generation failed");
        if (data.name && !form.workspaceName) set("workspaceName", data.name);
        const resolvedTransactionType = data.transactionType || aiTransactionType || "other";
        if (!aiTransactionType && resolvedTransactionType) setAiTransactionType(resolvedTransactionType);
        setCustomConfig({
          roles: (data.roles || []).map((r, i) => ({
            key: r.key || slugKey(r.label),
            label: r.label || "",
            icon: r.icon || ICON_CHOICES[i % ICON_CHOICES.length],
            color: r.color || COLOR_CHOICES[i % COLOR_CHOICES.length],
            required: !!r.required,
            needsDocs: r.needsDocs !== false,
            invitable: r.invitable !== false,
            canManage: i === 0 ? true : !!r.canManage,
          })),
          documents: (data.documents || []).map(d => ({
            id: d.id || slugKey(d.label),
            label: d.label || "",
            required: !!d.required,
            ai: !!d.ai,
            assignedRole: d.assignedRole || "",
          })),
          stages: (data.stages || []).map(s => ({
            key: s.key || slugKey(s.label),
            label: s.label || "",
          })),
        });
        setIsAiGenerated(true);
        // Keep form.packId in sync with the transaction type the AI used so the
        // Review & Activate step shows the correct pack label and buildPayload()
        // sends the right workflowPackId.
        const generatedPackId = data.packId || AI_TYPE_TO_PACK[resolvedTransactionType];
        if (generatedPackId) set("packId", generatedPackId);
        const firstAiRole = (data.roles || [])[0];
        if (firstAiRole?.key) set("role", firstAiRole.key);
        trackEvent("workspace_creation_phase", { phase: 1, mode: "ai" });
        setPhase(1);
      } catch (e) {
        setAiError(e.message);
      } finally {
        setAiLoading(false);
      }
      return;
    }

    // Phase 1 → Phase 2
    if (phase === 1) {
      trackEvent("workspace_creation_phase", { phase: 2, mode: creationMode });
      setPhase(2);
      return;
    }

    // Phase 2 → Phase 3
    if (phase === 2) {
      trackEvent("workspace_creation_phase", { phase: 3, mode: creationMode });
      setPhase(3);
      return;
    }
  }

  function goBack() {
    setError("");
    if (phase === 0) {
      if (showTemplatePicker) {
        setShowTemplatePicker(false);
        setCreationMode("ai");
        return;
      }
      navigate(-1);
      return;
    }
    if (phase === 1) { setPhase(0); return; }
    if (phase === 2 && creationMode === "blank") { setPhase(0); return; }
    if (phase === 2) { setPhase(1); return; }
    if (phase === 3) { setPhase(2); return; }
  }

  async function handleRegenerate() {
    // Go back to phase 0 and re-trigger AI generation
    setPhase(0);
    setCustomConfig({ roles: [], documents: [], stages: [] });
    setIsAiGenerated(false);
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function canContinue() {
    if (phase === 0) {
      if (creationMode === "blank") return true;
      if (showTemplatePicker) return !!form.packId;
      return aiDescription.trim().length > 10;
    }
    if (phase === 1) {
      return customConfig.roles.length > 0 &&
        customConfig.stages.length >= 2 &&
        customConfig.roles.every(r => r.label.trim()) &&
        customConfig.stages.every(s => s.label.trim());
    }
    if (phase === 2) return !!(form.workspaceName && form.firstName && form.lastName && form.email && form.agree);
    return true;
  }

  // ── Payload ───────────────────────────────────────────────────────────────
  function buildPayload() {
    const raw = (form.workspaceName || "").trim();
    // Generate a short random hex suffix so the workspace URL slug is unique but
    // clearly distinct from the workspace name. Using crypto-random bytes instead
    // of a timestamp avoids the base-36 fragment that looks like a corrupted name
    // suffix (e.g. "meridian-tower-m9k4" → "meridian-tower--a3f8c2d1").
    const randomHex = () => Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('');
    const propertyId = raw
      ? raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) + "--" + randomHex()
      : "ws--" + randomHex();
    const isBlank = creationMode === "blank";
    // In AI mode, derive the workflowPackId from aiTransactionType so the server
    // receives the correct base pack regardless of which pack was last selected in
    // the template picker.  Fall back to form.packId for template/blank modes.
    const workflowPackId = isBlank ? "blank"
      : (creationMode === "ai" && AI_TYPE_TO_PACK[aiTransactionType])
        ? AI_TYPE_TO_PACK[aiTransactionType]
        : form.packId;
    const configToSend = isBlank
      ? { roles: [], documents: [], stages: [] }
      : (customConfig.roles.length > 0 || customConfig.stages.length >= 2
        ? { ...customConfig, transactionType: aiTransactionType || (form.packId === "tokenization" ? "tokenization" : "") }
        : null);

    const resolvedRole = (() => {
      if (isBlank || customConfig.roles.length === 0) return form.role || "owner";
      const match = customConfig.roles.find(r => r.key === form.role);
      if (match) return match.key;
      const coord = customConfig.roles.find(r => r.canManage) || customConfig.roles[0];
      return coord?.key || form.role || "owner";
    })();

    return {
      propertyId,
      propertyName: raw || "Workspace",
      plan: "deal",
      email: form.email,
      role: resolvedRole,
      meta: {
        address: form.workspaceLocation,
        dealAmount: form.dealAmount,
        closingDate: form.closingDate,
        jurisdiction: form.jurisdiction || '',
        transactionType: aiTransactionType || (form.packId === "tokenization" ? "tokenization" : ""),
        firstName: form.firstName,
        lastName: form.lastName,
        workflowPackId,
        customConfig: configToSend,
        creationMode,
      },
    };
  }

  async function handleLaunch(demo = false) {
    setLoading(true);
    setError("");
    try {
      const endpoint = demo ? `${API_BASE}/api/checkout/trial` : `${API_BASE}/api/checkout/guest`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || data.message || "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800";
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

  return (
    <PublicLayout hideFooter>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-xl mx-auto">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 text-xs font-semibold text-gray-500 mb-4">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
               Deal room live in minutes
            </div>
             <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Deal Room</h1>
            <p className="text-gray-500 text-sm">Your transaction coordination workspace — every party, stage, and deadline in one deal room.</p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((label, i) => {
              const active = phaseToStepIdx(phase);
              return (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i <= active ? "text-white" : "bg-gray-200 text-gray-400"}`}
                      style={i <= active ? { background: "#800020" } : {}}
                    >
                      {i < active ? "✓" : i + 1}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${i === active ? "text-gray-900" : "text-gray-400"}`}>{label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-px max-w-8 ${i < active ? "bg-red-800" : "bg-gray-200"}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">

            {/* ── Phase 0: Describe ─────────────────────────────────────── */}
            {phase === 0 && !showTemplatePicker && creationMode !== "blank" && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-semibold text-gray-900 mb-1">What transaction are you coordinating?</h2>
                  <p className="text-xs text-gray-400">Be specific — company type, parties involved, current stage, any special requirements.</p>
                </div>

                <textarea
                  className={`${inputCls} h-32 resize-none`}
                  placeholder="e.g. I am acquiring a 15-location HVAC company in the Southeast. The seller is an individual owner. We have an LOI and are moving into due diligence."
                  value={aiDescription}
                  onChange={e => setAiDescription(e.target.value)}
                  autoFocus
                />

                {/* VTP outcome callout */}
                <div className="flex items-start gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-3">
                  <span className="text-base shrink-0 mt-0.5">📦</span>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Everything you do builds toward an <strong className="text-gray-700">AI-prepared transaction package</strong> — organized facts, source context, and outstanding actions ready for external review.
                  </p>
                </div>

                {/* Target closing date */}
                <div>
                  <label className={labelCls}>Target closing date <span className="font-normal text-gray-400">(optional)</span></label>
                  <input type="date" className={inputCls}
                    value={form.closingDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={e => set("closingDate", e.target.value)} />
                </div>

                {aiError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3.5 py-2.5">{aiError}</div>
                )}

                {/* Secondary paths */}
                <div className="flex items-center gap-4 text-xs text-gray-400 pt-1">
                  <button type="button"
                    onClick={() => { setShowTemplatePicker(true); setCreationMode("template"); setAiError(""); }}
                    className="underline hover:text-gray-700 transition">
                    Or start from a template
                  </button>
                  <span>·</span>
                  <button type="button"
                    onClick={() => { setCreationMode("blank"); setAiError(""); }}
                    className="underline hover:text-gray-700 transition">
                     Or start with a blank deal room
                  </button>
                </div>
              </div>
            )}

            {/* ── Phase 0: Blank confirmation ──────────────────────────── */}
            {phase === 0 && creationMode === "blank" && !showTemplatePicker && (
              <div className="space-y-4">
                <div>
                   <h2 className="font-semibold text-gray-900 mb-1">Start with a blank deal room</h2>
                   <p className="text-xs text-gray-400 mb-3">You'll add roles, documents, and stages directly inside the deal room after launch.</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-3 text-xs text-gray-500 leading-relaxed">
                   After launch, use the deal room settings to define your participants, upload documents, and configure transaction stages.
                </div>
                <button type="button"
                  onClick={() => { setCreationMode("ai"); }}
                  className="text-xs text-gray-400 underline hover:text-gray-700 transition">
                  ← Back to AI description
                </button>
              </div>
            )}

            {/* ── Phase 0: Template picker ─────────────────────────────── */}
            {phase === 0 && showTemplatePicker && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-semibold text-gray-900 mb-1">Choose a starting template</h2>
                  <p className="text-xs text-gray-400">You'll review and edit participants, documents, and stages before activating.</p>
                </div>

                {/* System templates */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Templates</p>
                  <div className="grid grid-cols-1 gap-2">
                    {systemPacks.filter(p => p.id !== 'tokenization').map(p => (
                      <button key={p.id} type="button" onClick={() => set("packId", p.id)}
                        className={`border rounded-xl p-3.5 text-left transition-all ${form.packId === p.id ? "border-red-800 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <p className={`text-sm font-semibold ${form.packId === p.id ? "text-red-800" : "text-gray-800"}`}>{p.label}</p>
                          <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "#800020" }}>Template</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Saved user templates */}
                {savedPacks.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Your saved templates</p>
                    <div className="grid grid-cols-1 gap-2">
                      {savedPacks.map(p => (
                        <div key={p.id}
                          className={`relative border rounded-xl p-3.5 transition-all cursor-pointer ${form.packId === p.id ? "border-red-800 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}
                          onClick={() => set("packId", p.id)}>
                          <div className="flex items-center justify-between mb-0.5">
                            <p className={`text-sm font-semibold ${form.packId === p.id ? "text-red-800" : "text-gray-800"}`}>{p.label}</p>
                            <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">Saved</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                          {/* Management actions */}
                          <div className="flex items-center gap-3 mt-2.5">
                            <button type="button" onClick={e => handleRenamePack(e, p)}
                              className="text-[11px] font-medium text-gray-400 hover:text-gray-700 transition">
                              Rename
                            </button>
                            <button type="button" onClick={e => handleDuplicatePack(e, p)}
                              className="text-[11px] font-medium text-gray-400 hover:text-gray-700 transition">
                              Duplicate
                            </button>
                            <button type="button" onClick={e => handleDeletePack(e, p.id)}
                              className="text-[11px] font-medium text-gray-400 hover:text-red-500 transition">
                              {deletingPackId === p.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Phase 1: Preview ─────────────────────────────────────── */}
            {phase === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold text-gray-900 mb-1">
                    {isAiGenerated ? "We set this up based on your description." : "Review your deal room"}
                  </h2>
                  <p className="text-xs text-gray-400">Review and continue — expand any section to make changes before activating.</p>
                </div>

                {/* AI classification notice — compact; type selector shown only when AI is low-confidence */}
                {isAiGenerated && (
                  <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-2.5">
                    <p className="text-xs text-gray-600">
                      {aiTransactionType && aiTransactionType !== 'other'
                        ? <><span className="font-semibold text-gray-800">{AI_TYPE_LABELS[aiTransactionType] || aiTransactionType}</span> · participants, documents, and stages pre-configured.</>
                        : "Configured as a custom transaction — review the sections below."}
                    </p>
                    {/* Type correction — shown only when AI returned 'other' or no type */}
                    {(!aiTransactionType || aiTransactionType === 'other') && (
                      <select
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-red-800/30 shrink-0"
                        value={aiTransactionType}
                        onChange={e => setAiTransactionType(e.target.value)}>
                        <option value="other">Custom</option>
                        <option value="business_acquisition">Business Acquisition</option>
                        <option value="cre_acquisition">CRE Acquisition</option>
                        <option value="fundraising">Fundraising</option>
                        <option value="lending">Lending / Finance</option>
                        <option value="licensing">Licensing</option>
                        <option value="joint_venture">Joint Venture</option>
                      </select>
                    )}
                  </div>
                )}

                {/* Digital asset note — shown only when AI classified as tokenization-relevant */}
                {isAiGenerated && TOKENIZATION_RELEVANT_TYPES.has(aiTransactionType) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3 text-xs text-blue-800 leading-relaxed">
                    <span className="font-semibold">Digital Asset Preparation is included.</span>{' '}
                    Because this looks like a token issuance or STO, your deal room will have jurisdiction
                    controls, cap table, and ownership structure available under Advanced Features in Settings.
                    You can disable it at any time.
                  </div>
                )}

                {/* Legal disclaimer */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-xs text-amber-800 leading-relaxed">
                   Kontra provides suggested transaction structures. Review the deal room with your legal, financial, and transaction advisers before relying on it.
                </div>

                {/* Collapsed sections */}
                <div className="space-y-2">
                  <CollapsedSection
                    title="Participants"
                    count={customConfig.roles.length}
                    icon="👥"
                  >
                    <RolesEditor roles={customConfig.roles} onChange={setRoles} />
                  </CollapsedSection>

                  <CollapsedSection
                    title="Documents"
                    count={customConfig.documents.length}
                    icon="📄"
                    description="Suggested diligence documents for this transaction — edit or remove anything that does not apply."
                  >
                    <DocumentsEditor
                      documents={customConfig.documents}
                      roles={customConfig.roles}
                      onChange={setDocuments}
                    />
                  </CollapsedSection>

                  <CollapsedSection
                    title="Stages"
                    count={customConfig.stages.length}
                    icon="🗂️"
                  >
                    <StagesEditor stages={customConfig.stages} onChange={setStages} />
                  </CollapsedSection>
                </div>
              </div>
            )}

            {/* ── Phase 2: Your Info ───────────────────────────────────── */}
            {phase === 2 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900 mb-1">Your info</h2>

                <div>
                   <label className={labelCls}>Deal room name *</label>
                  <input className={inputCls}
                    placeholder="e.g. Acme Manufacturing Acquisition"
                    value={form.workspaceName}
                    onChange={e => set("workspaceName", e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>First name *</label>
                    <input className={inputCls} value={form.firstName} onChange={e => set("firstName", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Last name *</label>
                    <input className={inputCls} value={form.lastName} onChange={e => set("lastName", e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Email *</label>
                  <input type="email" className={inputCls} placeholder="you@company.com"
                    value={form.email} onChange={e => set("email", e.target.value)} />
                </div>

                {jurisdictionRelevant && <div>
                  <label className={labelCls}>Jurisdiction <span className="font-normal text-gray-400">(optional)</span></label>
                  <select className={`${inputCls} bg-white`} value={form.jurisdiction} onChange={e => set("jurisdiction", e.target.value)}>
                    <option value="">Not specified</option>
                    <option value="uae_adgm">UAE — ADGM / DFSA</option>
                    <option value="eu_mica">EU — MiCA</option>
                    <option value="us_reg_d">US — Regulation D</option>
                    <option value="sg_mas">Singapore — MAS</option>
                    <option value="uk_fca">UK — FCA</option>
                    <option value="other">Other / Not listed</option>
                  </select>
                   <p className="text-xs text-gray-400 mt-1">Used to surface relevant regulatory checkpoints inside your deal room.</p>
                </div>}

                <div>
                  <label className={labelCls}>Your role in this transaction</label>
                  {creationMode !== "blank" && customConfig.roles.length > 0 ? (
                    <select className={`${inputCls} bg-white`} value={form.role} onChange={e => set("role", e.target.value)}>
                      {customConfig.roles.filter(r => r.label.trim()).map(r => (
                        <option key={r.key || r.label} value={r.key || slugKey(r.label)}>{r.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input className={inputCls} placeholder="e.g. Buyer, Owner, Sponsor"
                      value={form.role === "owner" ? "" : form.role}
                      onChange={e => set("role", e.target.value || "owner")} />
                  )}
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input type="checkbox" checked={form.agree} onChange={e => set("agree", e.target.checked)}
                    className="mt-0.5 accent-red-800 w-4 h-4 shrink-0" />
                  <span className="text-xs text-gray-500 leading-relaxed">
                    I agree to Kontra's{" "}
                    <a href="/terms" className="underline text-gray-700" target="_blank" rel="noreferrer">Terms of Service</a>{" "}
                    and{" "}
                    <a href="/privacy" className="underline text-gray-700" target="_blank" rel="noreferrer">Privacy Policy</a>.
                     I understand Kontra provides deal room infrastructure and does not act as a broker, lender, or financial adviser.
                  </span>
                </label>
              </div>
            )}

            {/* ── Phase 3: Review & Activate ───────────────────────────── */}
            {phase === 3 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900 mb-1">Review & activate</h2>

                {/* Summary card */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl divide-y divide-gray-200 overflow-hidden">
                  {[
                    { label: "Workspace", value: form.workspaceName || "—" },
                    jurisdictionRelevant && form.jurisdiction && { label: "Jurisdiction", value: { uae_adgm: "UAE — ADGM / DFSA", eu_mica: "EU — MiCA", us_reg_d: "US — Regulation D", sg_mas: "Singapore — MAS", uk_fca: "UK — FCA", other: "Other / Not listed" }[form.jurisdiction] || form.jurisdiction },
                    creationMode !== "blank" && { label: "Type", value: activePack?.label || "Custom" },
                    creationMode !== "blank" && customConfig.roles.length > 0 && { label: "Participants", value: `${customConfig.roles.length} role${customConfig.roles.length !== 1 ? "s" : ""}` },
                    creationMode !== "blank" && customConfig.documents.length > 0 && { label: "Documents", value: `${customConfig.documents.length} item${customConfig.documents.length !== 1 ? "s" : ""}` },
                    creationMode !== "blank" && customConfig.stages.length > 0 && { label: "Stages", value: `${customConfig.stages.length} stage${customConfig.stages.length !== 1 ? "s" : ""}` },
                    { label: "Contact", value: `${form.firstName} ${form.lastName} · ${form.email}` },
                    { label: "Price", value: "$499 one-time" },
                    { label: "Access", value: "90-day access after closing" },
                  ].filter(Boolean).map(r => (
                    <div key={r.label} className="flex justify-between items-start gap-4 px-4 py-3">
                      <span className="text-xs font-semibold text-gray-400 shrink-0 w-24">{r.label}</span>
                      <span className="text-sm text-gray-800 text-right break-words">{r.value}</span>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
                )}
              </div>
            )}
          </div>

          {/* ── Navigation buttons ──────────────────────────────────────── */}
          {phase === 3 ? (
            /* Activate step: primary + text link */
            <div className="space-y-3">
              <button type="button" onClick={() => handleLaunch(false)} disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-70 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: "#800020" }}>
                {loading ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Processing…</>
                ) : "🔐 Pay $499 and Activate Workspace"}
              </button>
              <div className="flex items-center gap-3">
                <button type="button" onClick={goBack}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                  ← Back
                </button>
                <button type="button" onClick={() => handleLaunch(true)} disabled={loading}
                  className="flex-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-800 transition disabled:opacity-50 underline">
                  Start with early access
                </button>
              </div>
            </div>
          ) : phase === 1 ? (
            /* Preview step: Continue + Regenerate */
            <div className="flex gap-3">
              <button type="button" onClick={goBack}
                className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                ← Back
              </button>
              {isAiGenerated && (
                <button type="button" onClick={handleRegenerate}
                  className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                  ↺ Regenerate
                </button>
              )}
              <button type="button" onClick={goNext} disabled={!canContinue()}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                style={{ background: "#800020" }}>
                Continue →
              </button>
            </div>
          ) : (
            /* Phase 0 and 2: standard back/next */
            <div className="flex gap-3">
              <button type="button" onClick={goBack}
                className="py-3 px-5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                ← Back
              </button>
              <button type="button" onClick={goNext} disabled={!canContinue() || aiLoading}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: "#800020" }}>
                {aiLoading ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Generating…</>
                ) : phase === 0 && creationMode === "ai" ? "Generate Deal Room →"
                  : phase === 0 && creationMode === "blank" ? "Continue to Your Info →"
                  : phase === 0 && showTemplatePicker ? "Use this template →"
                  : "Continue →"}
              </button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-4">
            Secured by Stripe · No subscription · Deal room live within minutes of payment
          </p>

        </div>
      </div>
    </PublicLayout>
  );
}
