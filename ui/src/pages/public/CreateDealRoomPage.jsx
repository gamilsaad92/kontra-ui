import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PublicLayout from "./PublicLayout";
import { listWorkflowPacks, fetchCustomPacks, getWorkflowPack } from "../../lib/workflowPacks";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const ICON_CHOICES = ["📄","🏢","💼","🏦","🔍","🛡️","⚖️","📊","⚙️","🏗️","🧾","📋","🤝","🏭","👤","🔑","✍️","📝","🌐","🏛️"];
const COLOR_CHOICES = ["#800020","#1d4ed8","#16a34a","#d97706","#6d28d9","#0369a1","#374151","#dc2626","#0891b2","#7c3aed"];

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
      // Preserve existing canManage; if none set, first role is coordinator
      canManage: r.canManage !== undefined ? !!r.canManage : i === 0,
    })),
    documents: (pack.documentSchema || pack.documents || []).map(d => ({
      id: d.id || slugKey(d.label),
      label: d.label || "",
      required: !!d.required,
      ai: !!d.ai,
      // Store as assignedRole (UI field); backend normalises to assignedTo on save
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

// ── CustomizationEditor ───────────────────────────────────────────────────────
function CustomizationEditor({ config, onChange, isAiGenerated }) {
  const { roles, documents, stages } = config;

  const updateRole = (i, patch) => onChange({ ...config, roles: roles.map((r, idx) => idx === i ? { ...r, ...patch } : r) });
  const addRole = () => onChange({ ...config, roles: [...roles, { key: "", label: "New Role", required: false, needsDocs: true, invitable: true, icon: ICON_CHOICES[roles.length % ICON_CHOICES.length], color: COLOR_CHOICES[roles.length % COLOR_CHOICES.length] }] });
  const removeRole = i => onChange({ ...config, roles: roles.filter((_, idx) => idx !== i) });

  const updateDoc = (i, patch) => onChange({ ...config, documents: documents.map((d, idx) => idx === i ? { ...d, ...patch } : d) });
  const addDoc = () => onChange({ ...config, documents: [...documents, { id: "", label: "New Document", required: false, ai: false, assignedRole: "" }] });
  const removeDoc = i => onChange({ ...config, documents: documents.filter((_, idx) => idx !== i) });

  const updateStage = (i, patch) => onChange({ ...config, stages: stages.map((s, idx) => idx === i ? { ...s, ...patch } : s) });
  const addStage = () => onChange({ ...config, stages: [...stages, { key: "", label: "New Stage" }] });
  const removeStage = i => onChange({ ...config, stages: stages.filter((_, idx) => idx !== i) });
  const moveStage = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= stages.length) return;
    const arr = [...stages];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange({ ...config, stages: arr });
  };

  const Badge = ({ on, onToggle, label }) => (
    <button type="button" onClick={onToggle}
      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors select-none ${on ? "text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
      style={on ? { background: "#800020" } : {}}>
      {label}
    </button>
  );

  const RemoveBtn = ({ onClick }) => (
    <button type="button" onClick={onClick}
      className="shrink-0 text-gray-300 hover:text-red-500 transition-colors text-xs ml-1 opacity-0 group-hover:opacity-100">✕</button>
  );

  return (
    <div className="space-y-5">
      {isAiGenerated && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-xs text-amber-800 leading-relaxed">
          <strong>AI-generated suggestions — review before launching.</strong> These suggestions may not include every document, approval, participant, or legal requirement. Review the workspace with qualified advisers before use.
        </div>
      )}

      {/* Roles */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Roles</span>
          <button type="button" onClick={addRole} className="text-xs font-semibold text-red-800 hover:underline">+ Add role</button>
        </div>
        {roles.length === 0 && <p className="text-xs text-gray-400 italic py-1">No roles yet.</p>}
        {roles.map((r, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 group">
            <span className="text-base w-5 shrink-0 text-center">{r.icon}</span>
            <InlineEdit value={r.label} onChange={v => updateRole(i, { label: v, key: slugKey(v) })} placeholder="Role name" className="flex-1 min-w-0" />
            <Badge on={r.required} onToggle={() => updateRole(i, { required: !r.required })} label="Required" />
            <Badge on={r.needsDocs} onToggle={() => updateRole(i, { needsDocs: !r.needsDocs })} label="Uploads" />
            {roles.length > 1 && <RemoveBtn onClick={() => removeRole(i)} />}
          </div>
        ))}
      </div>

      {/* Documents */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Documents</span>
          <button type="button" onClick={addDoc} className="text-xs font-semibold text-red-800 hover:underline">+ Add document</button>
        </div>
        {documents.length === 0 && <p className="text-xs text-gray-400 italic py-1">No documents yet.</p>}
        {documents.map((d, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 group">
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
            <RemoveBtn onClick={() => removeDoc(i)} />
          </div>
        ))}
      </div>

      {/* Stages */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Stages</span>
          <button type="button" onClick={addStage} className="text-xs font-semibold text-red-800 hover:underline">+ Add stage</button>
        </div>
        {stages.length < 2 && <p className="text-xs text-amber-600 italic mb-1">At least 2 stages required.</p>}
        {stages.map((s, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 group">
            <span className="text-xs text-gray-400 w-4 shrink-0 font-mono text-center">{i + 1}</span>
            <InlineEdit value={s.label} onChange={v => updateStage(i, { label: v, key: slugKey(v) })} placeholder="Stage name" className="flex-1 min-w-0" />
            <div className="flex gap-0.5 shrink-0">
              <button type="button" onClick={() => moveStage(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs px-1 leading-none">↑</button>
              <button type="button" onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs px-1 leading-none">↓</button>
            </div>
            {stages.length > 2 && <RemoveBtn onClick={() => removeStage(i)} />}
          </div>
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-3 text-xs text-gray-500 leading-relaxed">
        Templates are suggested starting points. Review and customize this workspace with your legal, financial, and transaction advisers.
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CreateDealRoomPage() {
  const navigate = useNavigate();

  // Creation path
  const [creationMode, setCreationMode] = useState(null); // null | 'template' | 'ai' | 'blank'
  // -1 = mode selector, 0 = setup, 1 = customize, 2 = your info, 3 = launch
  const [phase, setPhase] = useState(-1);

  // Packs
  const [workflowPacks, setWorkflowPacks] = useState(() => listWorkflowPacks());
  useEffect(() => { fetchCustomPacks().then(() => setWorkflowPacks(listWorkflowPacks())); }, []);

  // Form state
  const [form, setForm] = useState({
    packId: "business_acquisition",
    workspaceName: "",
    workspaceLocation: "",
    dealAmount: "",
    closingDate: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "owner",
    agree: false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Customization config (roles/docs/stages)
  const [customConfig, setCustomConfig] = useState({ roles: [], documents: [], stages: [] });

  // AI generation
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [isAiGenerated, setIsAiGenerated] = useState(false);

  // Launch
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Derived ───────────────────────────────────────────────────────────────
  const activePack = workflowPacks.find(p => p.id === form.packId) || workflowPacks[0];

  const STEP_LABELS = {
    template: ["Setup", "Customize", "Your Info", "Launch"],
    ai:       ["Describe", "Customize", "Your Info", "Launch"],
    blank:    ["Setup", "Your Info", "Launch"],
  };
  const steps = creationMode ? STEP_LABELS[creationMode] : [];

  function phaseToStepIndex(p) {
    if (creationMode === "blank") return p === 0 ? 0 : p === 2 ? 1 : 2;
    return p; // 0→0, 1→1, 2→2, 3→3
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  async function goNext() {
    if (phase === -1) {
      // Mode selected — move to setup
      if (creationMode) setPhase(0);
      return;
    }

    if (phase === 0 && creationMode === "ai") {
      // Trigger AI generation before moving to customize
      setAiLoading(true);
      setAiError("");
      try {
        const res = await fetch(`${API_BASE}/api/workspace/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: aiDescription }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "AI generation failed");
        // Pre-fill workspace name from AI suggestion
        if (data.name && !form.workspaceName) set("workspaceName", data.name);
        setCustomConfig({
          roles: (data.roles || []).map((r, i) => ({
            key: r.key || slugKey(r.label),
            label: r.label || "",
            icon: r.icon || ICON_CHOICES[i % ICON_CHOICES.length],
            color: r.color || COLOR_CHOICES[i % COLOR_CHOICES.length],
            required: !!r.required,
            needsDocs: r.needsDocs !== false,
            invitable: r.invitable !== false,
            // First role is always the workspace coordinator
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
        // Sync creator role to first coordinator role from AI suggestions
        const firstAiRole = (data.roles || [])[0];
        if (firstAiRole?.key) set("role", firstAiRole.key);
        setPhase(1);
      } catch (e) {
        setAiError(e.message);
      } finally {
        setAiLoading(false);
      }
      return;
    }

    if (phase === 0 && creationMode === "template") {
      // Pre-populate config from selected pack
      const pack = getWorkflowPack(form.packId);
      const config = configFromPack(pack);
      setCustomConfig(config);
      setIsAiGenerated(false);
      // Sync creator role to first coordinator role of this pack
      const coord = config.roles.find(r => r.canManage) || config.roles[0];
      if (coord) set("role", coord.key);
      setPhase(1);
      return;
    }

    // Blank: skip phase 1 (customize)
    if (creationMode === "blank" && phase === 0) { setPhase(2); return; }
    if (creationMode === "blank" && phase === 2) { setPhase(3); return; }

    setPhase(p => p + 1);
  }

  function goBack() {
    if (phase === 0) { setPhase(-1); return; }
    if (creationMode === "blank" && phase === 2) { setPhase(0); return; }
    setPhase(p => p - 1);
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function canContinue() {
    if (phase === -1) return !!creationMode;
    if (phase === 0) {
      if (creationMode === "ai") return aiDescription.trim().length > 10;
      return !!form.workspaceName.trim();
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
    // Require a non-empty, collision-safe workspace slug
    const propertyId = raw
      ? raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + Date.now().toString(36).slice(-4)
      : "ws-" + Date.now().toString(36);
    const isBlank = creationMode === "blank";
    const workflowPackId = isBlank ? "blank" : form.packId;
    // Always send customConfig for blank (even empty — backend assigns minimal defaults)
    // and for template/AI when the user has built a config.
    const configToSend = isBlank
      ? { roles: [], documents: [], stages: [] }
      : (customConfig.roles.length > 0 || customConfig.stages.length >= 2 ? customConfig : null);

    // Ensure the submitted role key actually exists in the custom config (prevents
    // stale "owner" default from being sent when the pack uses a different coordinator key)
    const resolvedRole = (() => {
      if (isBlank || customConfig.roles.length === 0) return form.role || "owner";
      const match = customConfig.roles.find(r => r.key === form.role);
      if (match) return match.key;
      // Fall back to first coordinator role, then first role
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
      const endpoint = demo ? `${API_BASE}/api/checkout/demo` : `${API_BASE}/api/checkout/guest`;
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

  // ── Render ────────────────────────────────────────────────────────────────
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
              Workspace live in minutes
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Transaction Workspace</h1>
            <p className="text-gray-500 text-sm">$499 one-time · All parties included · No subscription required</p>
          </div>

          {/* Step indicator (hidden on mode selector) */}
          {phase >= 0 && creationMode && (
            <div className="flex items-center justify-center gap-2 mb-8">
              {steps.map((label, i) => {
                const active = phaseToStepIndex(phase);
                return (
                  <React.Fragment key={label}>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i <= active ? "text-white" : "bg-gray-200 text-gray-400"}`}
                        style={i <= active ? { background: "#800020" } : {}}>
                        {i < active ? "✓" : i + 1}
                      </div>
                      <span className={`text-xs font-medium hidden sm:block ${i === active ? "text-gray-900" : "text-gray-400"}`}>{label}</span>
                    </div>
                    {i < steps.length - 1 && <div className={`flex-1 h-px max-w-8 ${i < active ? "bg-red-800" : "bg-gray-200"}`} />}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">

            {/* ── Phase -1: Mode selector ─────────────────────────────── */}
            {phase === -1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold text-gray-900 mb-1">How do you want to set up your workspace?</h2>
                  <p className="text-xs text-gray-400 mb-4">Choose a starting point. You can customize everything before and after launch.</p>
                </div>

                {[
                  {
                    mode: "template",
                    icon: "📋",
                    title: "Start from a template",
                    desc: "Pick Business Acquisition, CRE, or Fundraising — then edit the roles, documents, and stages to fit your deal.",
                    badge: "Most common",
                  },
                  {
                    mode: "ai",
                    icon: "✨",
                    title: "Build with AI",
                    desc: "Describe your transaction in plain language. AI will suggest a complete workspace — you review and adjust before launching.",
                    badge: "Fastest",
                  },
                  {
                    mode: "blank",
                    icon: "⬜",
                    title: "Start blank",
                    desc: "Create an empty workspace and define everything yourself — roles, checklist, and stages — inside the workspace after launch.",
                    badge: null,
                  },
                ].map(({ mode, icon, title, desc, badge }) => (
                  <button key={mode} type="button" onClick={() => setCreationMode(mode)}
                    className={`w-full border rounded-xl p-4 text-left transition-all ${creationMode === mode ? "border-red-800 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-sm font-semibold ${creationMode === mode ? "text-red-800" : "text-gray-800"}`}>{title}</span>
                          {badge && <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "#800020" }}>{badge}</span>}
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── Phase 0: Setup ──────────────────────────────────────── */}
            {phase === 0 && creationMode === "template" && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold text-gray-900 mb-0.5">Choose a starting template</h2>
                  <p className="text-xs text-gray-400 mb-3">You'll edit the roles, documents, and stages in the next step before launching.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  {workflowPacks.filter(p => ["business_acquisition","cre_acquisition","fundraising"].includes(p.id)).map(p => (
                    <button key={p.id} type="button" onClick={() => set("packId", p.id)}
                      className={`border rounded-xl p-3.5 text-left transition-all ${form.packId === p.id ? "border-red-800 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className={`text-sm font-semibold ${form.packId === p.id ? "text-red-800" : "text-gray-800"}`}>{p.label}</p>
                        <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "#800020" }}>Template</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                    </button>
                  ))}
                  {/* Any custom packs from DB */}
                  {workflowPacks.filter(p => !["business_acquisition","cre_acquisition","fundraising"].includes(p.id)).map(p => (
                    <button key={p.id} type="button" onClick={() => set("packId", p.id)}
                      className={`border rounded-xl p-3.5 text-left transition-all ${form.packId === p.id ? "border-red-800 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className={`text-sm font-semibold ${form.packId === p.id ? "text-red-800" : "text-gray-800"}`}>{p.label}</p>
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">Saved</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                    </button>
                  ))}
                </div>

                <div>
                  <label className={labelCls}>Workspace Name *</label>
                  <input className={inputCls} placeholder="e.g. Acme Manufacturing Acquisition"
                    value={form.workspaceName} onChange={e => set("workspaceName", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Location / Address</label>
                  <input className={inputCls} placeholder="City, State or full address"
                    value={form.workspaceLocation} onChange={e => set("workspaceLocation", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Transaction Size</label>
                    <input className={inputCls} placeholder="e.g. $8,500,000"
                      value={form.dealAmount} onChange={e => set("dealAmount", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Target Close Date</label>
                    <input type="date" className={inputCls}
                      value={form.closingDate} onChange={e => set("closingDate", e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {phase === 0 && creationMode === "ai" && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold text-gray-900 mb-1">Describe the transaction you're coordinating</h2>
                  <p className="text-xs text-gray-400 mb-3">
                    AI will suggest roles, a document checklist, and transaction stages. You'll review and edit everything before launching.
                  </p>
                </div>
                <div>
                  <textarea
                    className={`${inputCls} h-32 resize-none`}
                    placeholder="e.g. I am acquiring a 15-location HVAC company in the Southeast. The seller is an individual owner. We have an LOI and are moving into due diligence."
                    value={aiDescription}
                    onChange={e => setAiDescription(e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">Be specific — company type, parties involved, current stage, any special requirements.</p>
                </div>
                {aiError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3.5 py-2.5">{aiError}</div>
                )}
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-3 text-xs text-blue-700 leading-relaxed">
                  <strong>Notice:</strong> AI-generated suggestions may not include every document, approval, participant, or legal requirement. Review the workspace with your legal, financial, and transaction advisers before use.
                </div>
              </div>
            )}

            {phase === 0 && creationMode === "blank" && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-semibold text-gray-900 mb-1">Name your workspace</h2>
                  <p className="text-xs text-gray-400 mb-3">You'll add roles, documents, and stages directly inside the workspace after launch.</p>
                </div>
                <div>
                  <label className={labelCls}>Workspace Name *</label>
                  <input className={inputCls} placeholder="e.g. Riverstone Capital Deal Room"
                    value={form.workspaceName} onChange={e => set("workspaceName", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Location / Address</label>
                  <input className={inputCls} placeholder="City, State or full address (optional)"
                    value={form.workspaceLocation} onChange={e => set("workspaceLocation", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Transaction Size</label>
                    <input className={inputCls} placeholder="e.g. $8,500,000"
                      value={form.dealAmount} onChange={e => set("dealAmount", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Target Close Date</label>
                    <input type="date" className={inputCls}
                      value={form.closingDate} onChange={e => set("closingDate", e.target.value)} />
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-3 text-xs text-gray-500 leading-relaxed">
                  Kontra provides workflow tools, suggested templates, and AI-assisted document coordination. Suggestions are not legal, financial, tax, underwriting, or compliance advice. The workspace owner is responsible for reviewing and configuring the workspace with appropriate professional advisers.
                </div>
              </div>
            )}

            {/* ── Phase 1: Customize ──────────────────────────────────── */}
            {phase === 1 && (
              <div>
                <h2 className="font-semibold text-gray-900 mb-4">
                  {creationMode === "ai" ? "Review AI suggestions" : `Customize your workspace`}
                </h2>
                <CustomizationEditor config={customConfig} onChange={setCustomConfig} isAiGenerated={isAiGenerated} />
              </div>
            )}

            {/* ── Phase 2: Your Info ──────────────────────────────────── */}
            {phase === 2 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900 mb-4">Your contact info</h2>

                {/* For AI mode, workspace name may have been auto-filled but allow editing */}
                {creationMode === "ai" && (
                  <div>
                    <label className={labelCls}>Workspace Name *</label>
                    <input className={inputCls}
                      placeholder="e.g. Acme Manufacturing Acquisition"
                      value={form.workspaceName}
                      onChange={e => set("workspaceName", e.target.value)} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>First Name *</label>
                    <input className={inputCls} value={form.firstName} onChange={e => set("firstName", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name *</label>
                    <input className={inputCls} value={form.lastName} onChange={e => set("lastName", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Email *</label>
                  <input type="email" className={inputCls} placeholder="you@company.com"
                    value={form.email} onChange={e => set("email", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Your Role in this Transaction</label>
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
                    I understand Kontra provides transaction workspace infrastructure only and does not act as a broker, lender, or financial adviser.
                  </span>
                </label>
              </div>
            )}

            {/* ── Phase 3: Review & Launch ────────────────────────────── */}
            {phase === 3 && (
              <div>
                <h2 className="font-semibold text-gray-900 mb-4">Review & Launch</h2>
                <div className="space-y-0 mb-5">
                  {[
                    { label: "Workspace", value: form.workspaceName },
                    form.workspaceLocation && { label: "Location", value: form.workspaceLocation },
                    form.dealAmount && { label: "Size", value: form.dealAmount },
                    creationMode !== "blank" && { label: "Template", value: activePack?.label || "Custom" },
                    creationMode !== "blank" && customConfig.roles.length > 0 && { label: "Roles", value: customConfig.roles.map(r => r.label).filter(Boolean).join(", ") },
                    creationMode !== "blank" && customConfig.stages.length > 0 && { label: "Stages", value: customConfig.stages.map(s => s.label).filter(Boolean).join(" → ") },
                    creationMode !== "blank" && customConfig.documents.length > 0 && { label: "Documents", value: `${customConfig.documents.length} items` },
                    { label: "Contact", value: `${form.firstName} ${form.lastName} · ${form.email}` },
                  ].filter(Boolean).map(r => (
                    <div key={r.label} className="flex justify-between items-start gap-4 py-2.5 border-b border-gray-100 last:border-0">
                      <span className="text-xs font-semibold text-gray-400 shrink-0 w-20">{r.label}</span>
                      <span className="text-sm text-gray-800 text-right break-words">{r.value}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Workspace Access</span>
                    <span className="text-lg font-bold text-gray-900">$499</span>
                  </div>
                  <ul className="text-xs text-gray-500 space-y-1">
                    {["All party portals — role-scoped access for every stakeholder", "AI document analysis", "Transaction health & risk tracking", "Role-scoped invite links", "90-day access after close"].map(f => (
                      <li key={f} className="flex items-center gap-1.5"><span className="text-green-500">✓</span>{f}</li>
                    ))}
                  </ul>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {phase > -1 && (
              <button type="button" onClick={goBack}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                ← Back
              </button>
            )}

            {phase < 3 ? (
              <button type="button" onClick={goNext} disabled={!canContinue() || aiLoading}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: "#800020" }}>
                {aiLoading ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Generating…</>
                ) : phase === 0 && creationMode === "ai" ? "Generate Workspace →" : "Continue →"}
              </button>
            ) : (
              <div className="flex-1 flex flex-col gap-2">
                <button type="button" onClick={() => handleLaunch(false)} disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-70 hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ background: "#800020" }}>
                  {loading ? (
                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Launching…</>
                  ) : "🔐 Pay $499 & Launch Workspace"}
                </button>
                <button type="button" onClick={() => handleLaunch(true)} disabled={loading}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition disabled:opacity-50 flex items-center justify-center gap-2">
                  🧪 Try Demo (skip payment)
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            Secured by Stripe · No subscription · Workspace live within minutes of payment
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
