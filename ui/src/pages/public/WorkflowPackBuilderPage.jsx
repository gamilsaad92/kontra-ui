import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

// A brand-new Workflow Pack is nothing but this shape — roles, stages, and a
// document checklist — turned into a working pack at runtime by
// genericPackFactory.createGenericPack(). Building one here never requires
// writing or deploying a .js file; see ui/src/lib/workflowPacks/index.js
// (registerCustomPack) for how it's activated.
const ICON_CHOICES = ["📄", "🏢", "💼", "🏦", "🔍", "🛡️", "⚖️", "📊", "⚙️", "🏗️", "🧾", "📋", "🤝", "🏭"];
const COLOR_CHOICES = ["#800020", "#1d4ed8", "#16a34a", "#d97706", "#6d28d9", "#0369a1", "#374151", "#dc2626"];

function newRole(i) {
  return {
    key: "", label: "", shortLabel: "", icon: ICON_CHOICES[i % ICON_CHOICES.length],
    color: COLOR_CHOICES[i % COLOR_CHOICES.length], required: i === 0, needsDocs: i !== 0, invitable: i !== 0,
  };
}

function newStage() {
  return { key: "", label: "" };
}

function newDocument() {
  return { id: "", label: "", required: true, ai: false, metrics: "" };
}

function newOnboardingStep() {
  return { icon: "📄", title: "", desc: "" };
}

function slugKey(s) {
  return String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export default function WorkflowPackBuilderPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [roles, setRoles] = useState([newRole(0), newRole(1)]);
  const [stages, setStages] = useState([{ key: "uploading", label: "Uploading Documents" }, { key: "under_review", label: "Under Review" }, { key: "approved", label: "Approved" }]);
  const [documents, setDocuments] = useState([newDocument()]);
  const [onboardingSteps, setOnboardingSteps] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null);

  const updateRole = (i, patch) => setRoles(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const updateStage = (i, patch) => setStages(ss => ss.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const updateDoc = (i, patch) => setDocuments(ds => ds.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  const updateStep = (i, patch) => setOnboardingSteps(steps => steps.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const canSave = name.trim() &&
    roles.length > 0 && roles.every(r => r.key.trim() && r.label.trim()) &&
    stages.length >= 2 && stages.every(s => s.key.trim() && s.label.trim()) &&
    documents.length > 0 && documents.every(d => d.id.trim() && d.label.trim());

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        roles: roles.map(r => ({
          key: slugKey(r.key), label: r.label.trim(), shortLabel: r.shortLabel.trim() || undefined,
          icon: r.icon, color: r.color, required: !!r.required, needsDocs: !!r.needsDocs, invitable: !!r.invitable,
        })),
        stages: stages.map(s => ({ key: slugKey(s.key), label: s.label.trim() })),
        documents: documents.map(d => ({
          id: slugKey(d.id), label: d.label.trim(), required: !!d.required, ai: !!d.ai,
          ...(d.ai && d.metrics.trim() ? {
            aiExtraction: {
              docTypes: [d.label.trim()],
              metrics: Object.fromEntries(
                d.metrics.split(",").map(m => m.trim()).filter(Boolean).map(m => [slugKey(m), { type: "number" }])
              ),
            },
          } : {}),
        })),
        onboardingSteps: onboardingSteps
          .filter(s => s.title.trim())
          .map(s => ({ icon: s.icon || "📄", title: s.title.trim(), desc: s.desc.trim() })),
      };
      const res = await fetch(`${API_BASE}/api/workflow-packs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save workflow pack");
      setSaved(data.pack);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <PublicLayout hideFooter>
        <div className="min-h-screen bg-gray-50 py-16 px-4">
          <div className="max-w-lg mx-auto text-center bg-white border border-gray-200 rounded-2xl p-10 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-2xl mx-auto mb-4">✓</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">"{saved.name}" is ready</h1>
            <p className="text-sm text-gray-500 mb-6">
              This workflow pack is live — it now shows up as an option when creating a new deal room, with your roles, stages, and document checklist wired in automatically.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => navigate("/create-deal-room")} className="w-full py-2.5 rounded-lg text-white font-semibold text-sm" style={{ background: "#800020" }}>
                Create a deal room with it →
              </button>
              <button onClick={() => { setSaved(null); setName(""); setDescription(""); setRoles([newRole(0), newRole(1)]); setStages([{ key: "uploading", label: "Uploading Documents" }, { key: "under_review", label: "Under Review" }, { key: "approved", label: "Approved" }]); setDocuments([newDocument()]); setOnboardingSteps([]); }}
                className="w-full py-2.5 rounded-lg border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50">
                Build another pack
              </button>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout hideFooter>
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 text-xs font-semibold text-gray-500 mb-4">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              No code required
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Workflow Pack Builder</h1>
            <p className="text-gray-500 text-sm max-w-xl">
              Assemble a brand-new deal room type — its roles, stages, and required documents — and it's immediately available to use, no engineering work needed.
            </p>
          </div>

          {/* Pack metadata */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
            <h2 className="font-semibold text-gray-900 mb-4">Pack details</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Pack Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Construction Loan"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="A short description of this deal type"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300" />
              </div>
            </div>
          </section>

          {/* Roles */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Roles</h2>
              <button onClick={() => setRoles(rs => [...rs, newRole(rs.length)])}
                className="text-xs font-semibold text-red-800 hover:underline">+ Add role</button>
            </div>
            <div className="space-y-3">
              {roles.map((r, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                  <input value={r.label} onChange={e => updateRole(i, { label: e.target.value, key: r.key || slugKey(e.target.value) })}
                    placeholder="Role label (e.g. Buyer)" className="col-span-2 sm:col-span-2 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                  <select value={r.icon} onChange={e => updateRole(i, { icon: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                    {ICON_CHOICES.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                  <input type="color" value={r.color} onChange={e => updateRole(i, { color: e.target.value })} className="w-10 h-8 border border-gray-200 rounded-lg" />
                  <div className="flex items-center gap-3 text-xs text-gray-600 col-span-2 sm:col-span-1 flex-wrap">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={r.required} onChange={e => updateRole(i, { required: e.target.checked })} />Required</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={r.needsDocs} onChange={e => updateRole(i, { needsDocs: e.target.checked })} />Uploads docs</label>
                  </div>
                  {roles.length > 1 && (
                    <button onClick={() => setRoles(rs => rs.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600 text-xs justify-self-end">Remove</button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Stages */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Stages</h2>
              <button onClick={() => setStages(ss => [...ss, newStage()])}
                className="text-xs font-semibold text-red-800 hover:underline">+ Add stage</button>
            </div>
            <div className="space-y-2">
              {stages.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                  <input value={s.label} onChange={e => updateStage(i, { label: e.target.value, key: s.key || slugKey(e.target.value) })}
                    placeholder={`Stage ${i + 1} label`} className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                  {stages.length > 2 && (
                    <button onClick={() => setStages(ss => ss.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600 text-xs">Remove</button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Deal rooms move through these stages in order, first to last.</p>
          </section>

          {/* Documents */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Document checklist</h2>
              <button onClick={() => setDocuments(ds => [...ds, newDocument()])}
                className="text-xs font-semibold text-red-800 hover:underline">+ Add document</button>
            </div>
            <div className="space-y-3">
              {documents.map((d, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={d.label} onChange={e => updateDoc(i, { label: e.target.value, id: d.id || slugKey(e.target.value) })}
                      placeholder="Document name (e.g. Loan Agreement)" className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                    <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap"><input type="checkbox" checked={d.required} onChange={e => updateDoc(i, { required: e.target.checked })} />Required</label>
                    <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap"><input type="checkbox" checked={d.ai} onChange={e => updateDoc(i, { ai: e.target.checked })} />AI analysis</label>
                    {documents.length > 1 && (
                      <button onClick={() => setDocuments(ds => ds.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600 text-xs">Remove</button>
                    )}
                  </div>
                  {d.ai && (
                    <input value={d.metrics} onChange={e => updateDoc(i, { metrics: e.target.value })}
                      placeholder="Metrics to extract, comma-separated (e.g. loan_amount, interest_rate)"
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs" />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Onboarding checklist copy (optional) */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-gray-900">Onboarding checklist (optional)</h2>
              <button onClick={() => setOnboardingSteps(steps => [...steps, newOnboardingStep()])}
                className="text-xs font-semibold text-red-800 hover:underline">+ Add step</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Shown as "Step 2 — Populate your deal room" after checkout. Leave blank and we'll generate sensible steps from your document checklist automatically.
            </p>
            <div className="space-y-3">
              {onboardingSteps.map((s, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <select value={s.icon} onChange={e => updateStep(i, { icon: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                      {ICON_CHOICES.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                    </select>
                    <input value={s.title} onChange={e => updateStep(i, { title: e.target.value })}
                      placeholder="Step title (e.g. Upload financial statements)" className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" />
                    <button onClick={() => setOnboardingSteps(steps => steps.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600 text-xs">Remove</button>
                  </div>
                  <input value={s.desc} onChange={e => updateStep(i, { desc: e.target.value })}
                    placeholder="Short description of what happens next" className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs" />
                </div>
              ))}
              {onboardingSteps.length === 0 && (
                <p className="text-xs text-gray-400 italic">No custom steps yet — default steps will be generated from your document checklist.</p>
              )}
            </div>
          </section>

          {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</div>}

          <button onClick={handleSave} disabled={!canSave || saving}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#800020" }}>
            {saving ? "Saving…" : "Save workflow pack"}
          </button>
        </div>
      </div>
    </PublicLayout>
  );
}
