import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PublicLayout from "./PublicLayout";
import { listWorkflowPacks, fetchCustomPacks, DEFAULT_PACK_ID } from "../../lib/workflowPacks";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const PROPERTY_TYPES = [
  "Multifamily", "Office", "Industrial", "Retail", "Mixed-Use",
  "Hotel / Hospitality", "Self-Storage", "Land / Development", "Other",
];

const DEAL_TYPES = [
  { id: "acquisition", label: "Acquisition", desc: "Buying a property" },
  { id: "refinance", label: "Refinance", desc: "Replacing existing debt" },
  { id: "construction", label: "Construction / Value-Add", desc: "Development or major renovation" },
  { id: "flag_conversion", label: "Flag Conversion", desc: "Switching hotel brand / franchise" },
  { id: "sale", label: "Sale", desc: "Listing for sale with diligence room" },
];

const STEPS = ["Workspace", "Details", "Your Info", "Launch"];

export default function CreateDealRoomPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Which Workflow Pack a deal room uses drives the entire rest of its
  // experience (checklist, roles, health scoring, coordination stages).
  // This is the only place a user chooses it — see ui/src/lib/workflowPacks/.
  // Custom packs (built via the Workflow Pack Builder) are stored server-side
  // and registered at runtime, so this list starts with the built-in packs
  // and grows once fetchCustomPacks() resolves.
  const [workflowPacks, setWorkflowPacks] = useState(() => listWorkflowPacks());

  useEffect(() => {
    fetchCustomPacks().then(() => setWorkflowPacks(listWorkflowPacks()));
  }, []);

  const [form, setForm] = useState({
    packId: DEFAULT_PACK_ID,
    propertyName: "",
    propertyAddress: "",
    propertyType: "",
    propertySize: "",
    dealType: "",
    dealAmount: "",
    closingDate: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "owner",
    agree: false,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setPack = (packId) => {
    const pack = workflowPacks.find(p => p.id === packId);
    setForm((f) => ({ ...f, packId, role: pack?.roles?.[0]?.key || f.role }));
  };

  const isBusinessPack = form.packId !== DEFAULT_PACK_ID;
  const activePack = workflowPacks.find(p => p.id === form.packId) || workflowPacks[0];

  const canNext = () => {
    if (step === 0) return form.propertyName && form.propertyAddress && (isBusinessPack || form.propertyType);
    if (step === 1) return form.dealType && form.dealAmount;
    if (step === 2) return form.firstName && form.lastName && form.email && form.agree;
    return true;
  };

  const buildPayload = () => {
    const propertyId = form.propertyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      propertyId,
      propertyName: form.propertyName,
      plan: "deal",
      email: form.email,
      role: form.role,
      meta: {
        address: form.propertyAddress,
        type: form.propertyType,
        size: form.propertySize,
        dealType: form.dealType,
        dealAmount: form.dealAmount,
        closingDate: form.closingDate,
        firstName: form.firstName,
        lastName: form.lastName,
        workflowPackId: form.packId,
      },
    };
  };

  const handleLaunch = async (demo = false) => {
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
    } catch (e) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <PublicLayout hideFooter>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 text-xs font-semibold text-gray-500 mb-4">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              Deal room live in minutes
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Workspace</h1>
            <p className="text-gray-500 text-sm">
              $499 one-time · All parties included · No subscription required
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${i < step ? "text-white" : i === step ? "text-white" : "bg-gray-200 text-gray-400"}`}
                    style={i <= step ? { background: "#800020" } : {}}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-gray-900" : "text-gray-400"}`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-px max-w-8 ${i < step ? "bg-red-800" : "bg-gray-200"}`} />}
              </React.Fragment>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">

            {/* Step 0 — Workspace + Property/Business Info */}
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900 mb-1">What kind of deal are you closing?</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  {workflowPacks.map(p => (
                    <button key={p.id} onClick={() => setPack(p.id)}
                      className={`border rounded-xl p-3.5 text-left transition-all ${form.packId === p.id ? "border-red-800 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <p className={`text-sm font-semibold ${form.packId === p.id ? "text-red-800" : "text-gray-800"}`}>{p.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    {isBusinessPack ? "Business Name *" : "Property Name *"}
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                    placeholder={isBusinessPack ? "e.g. Acme Manufacturing LLC" : "e.g. Harbor View Apartments"}
                    value={form.propertyName}
                    onChange={e => set("propertyName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    {isBusinessPack ? "Business Location *" : "Property Address *"}
                  </label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                    placeholder={isBusinessPack ? "City, State" : "123 Main St, City, State ZIP"}
                    value={form.propertyAddress}
                    onChange={e => set("propertyAddress", e.target.value)}
                  />
                </div>
                {!isBusinessPack && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Property Type *</label>
                      <select
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 bg-white"
                        value={form.propertyType}
                        onChange={e => set("propertyType", e.target.value)}
                      >
                        <option value="">Select type</option>
                        {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Size (SF or units)</label>
                      <input
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                        placeholder="e.g. 45,000 SF"
                        value={form.propertySize}
                        onChange={e => set("propertySize", e.target.value)}
                      />
                    </div>
                  </div>
                )}
                {isBusinessPack && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Industry (optional)</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                      placeholder="e.g. Manufacturing"
                      value={form.propertySize}
                      onChange={e => set("propertySize", e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 1 — Deal Details */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900 mb-4">What kind of deal is this?</h2>
                <div className="grid grid-cols-2 gap-2">
                  {DEAL_TYPES.map(d => (
                    <button key={d.id} onClick={() => set("dealType", d.id)}
                      className={`border rounded-xl p-3.5 text-left transition-all ${form.dealType === d.id ? "border-red-800 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <p className={`text-sm font-semibold ${form.dealType === d.id ? "text-red-800" : "text-gray-800"}`}>{d.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{d.desc}</p>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Deal Size *</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                      placeholder="e.g. $8,500,000"
                      value={form.dealAmount}
                      onChange={e => set("dealAmount", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Target Close Date</label>
                    <input
                      type="date"
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                      value={form.closingDate}
                      onChange={e => set("closingDate", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — Your Info */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900 mb-4">Your contact info</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">First Name *</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                      value={form.firstName}
                      onChange={e => set("firstName", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Last Name *</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                      value={form.lastName}
                      onChange={e => set("lastName", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Email *</label>
                  <input
                    type="email"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={e => set("email", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Your Role</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800 bg-white"
                    value={form.role}
                    onChange={e => set("role", e.target.value)}
                  >
                    {isBusinessPack ? (
                      (activePack.roles || []).map(r => (
                        <option key={r.key} value={r.key}>{r.label}</option>
                      ))
                    ) : (
                      <>
                        <option value="owner">Property Owner</option>
                        <option value="borrower">Borrower / Sponsor</option>
                        <option value="broker">Broker</option>
                        <option value="lender">Lender</option>
                        <option value="attorney">Attorney</option>
                      </>
                    )}
                  </select>
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input type="checkbox" checked={form.agree} onChange={e => set("agree", e.target.checked)}
                    className="mt-0.5 accent-red-800 w-4 h-4 shrink-0" />
                  <span className="text-xs text-gray-500 leading-relaxed">
                    I agree to Kontra's <a href="/terms" className="underline text-gray-700" target="_blank">Terms of Service</a> and <a href="/privacy" className="underline text-gray-700" target="_blank">Privacy Policy</a>. I understand Kontra provides deal room infrastructure only and does not act as a broker, lender, or financial advisor.
                  </span>
                </label>
              </div>
            )}

            {/* Step 3 — Review & Launch */}
            {step === 3 && (
              <div>
                <h2 className="font-semibold text-gray-900 mb-4">Review & Launch</h2>
                <div className="space-y-3 mb-6">
                  {[
                    { label: "Workspace", value: activePack.name },
                    { label: isBusinessPack ? "Business" : "Property", value: form.propertyName },
                    { label: isBusinessPack ? "Location" : "Address", value: form.propertyAddress },
                    ...(isBusinessPack ? [] : [{ label: "Type", value: form.propertyType + (form.propertySize ? ` · ${form.propertySize}` : "") }]),
                    { label: "Deal", value: DEAL_TYPES.find(d => d.id === form.dealType)?.label + (form.dealAmount ? ` · ${form.dealAmount}` : "") },
                    { label: "Contact", value: `${form.firstName} ${form.lastName} · ${form.email}` },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between items-start gap-4 py-2.5 border-b border-gray-100 last:border-0">
                      <span className="text-xs font-semibold text-gray-400 shrink-0 w-20">{r.label}</span>
                      <span className="text-sm text-gray-800 text-right">{r.value}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Deal Room Access</span>
                    <span className="text-lg font-bold text-gray-900">$499</span>
                  </div>
                  <ul className="text-xs text-gray-500 space-y-1">
                    {["All party portals (lender, inspector, insurer, attorney, investor)", "AI document analysis", "Compliance tracking", "Role-scoped invite links", "90-day access after close"].map(f => (
                      <li key={f} className="flex items-center gap-1.5"><span className="text-green-500">✓</span>{f}</li>
                    ))}
                  </ul>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                ← Back
              </button>
            )}
            {step < 3 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                style={{ background: "#800020" }}>
                Continue →
              </button>
            ) : (
              <div className="flex-1 flex flex-col gap-2">
                <button onClick={() => handleLaunch(false)} disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-70 hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ background: "#800020" }}>
                  {loading ? (
                    <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Launching…</>
                  ) : (
                    <>🔐 Pay $499 & Launch Deal Room</>
                  )}
                </button>
                <button onClick={() => handleLaunch(true)} disabled={loading}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition disabled:opacity-50 flex items-center justify-center gap-2">
                  🧪 Try Demo (skip payment)
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            Secured by Stripe · No subscription · Deal room live within minutes of payment
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
