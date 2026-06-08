import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProperties } from "../../hooks/useProperties";

const PROPERTY_TYPES = ["Multifamily", "Office", "Industrial", "Retail", "Mixed-Use", "Hospitality", "Healthcare", "Self-Storage", "Land"];
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const STEPS = [
  { n: 1, label: "Basic Info", desc: "What is this property?" },
  { n: 2, label: "Details", desc: "Size and occupancy" },
  { n: 3, label: "Financials", desc: "Optional — add later" },
];

export default function AddPropertyPage() {
  const { addProperty } = useProperties();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "Multifamily", address: "", city: "", state: "CA",
    units: "", sqft: "", yearBuilt: "", occupancy: "", noi: "",
  });
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validateStep = () => {
    const errs = {};
    if (step === 1) {
      if (!form.name.trim()) errs.name = "Property name is required";
      if (!form.address.trim()) errs.address = "Address is required";
      if (!form.city.trim()) errs.city = "City is required";
    }
    if (step === 2) {
      if (!form.occupancy) errs.occupancy = "Occupancy is required";
      if (form.occupancy && (Number(form.occupancy) < 0 || Number(form.occupancy) > 100)) {
        errs.occupancy = "Must be 0–100";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => { if (validateStep()) setStep((s) => s + 1); };
  const back = () => { setStep((s) => s - 1); setErrors({}); };

  const handleSave = async () => {
    if (!validateStep()) return;
    setSaving(true);
    const prop = addProperty(form);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    navigate("/app/properties", { state: { newPropertyId: prop.id } });
  };

  const fieldClass = (name) =>
    `w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 outline-none transition ${
      errors[name] ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-gray-400 bg-white"
    }`;

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate("/app/properties")}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1.5 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          My Properties
        </button>
        <h2 className="text-xl font-bold text-gray-900">Add a Property</h2>
        <p className="text-sm text-gray-500 mt-0.5">Takes about 2 minutes. You can add details later.</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.n}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                step > s.n ? "bg-green-500 text-white"
                : step === s.n ? "text-white" : "bg-gray-100 text-gray-400"
              }`} style={step === s.n ? { background: "#800020" } : {}}>
                {step > s.n ? "✓" : s.n}
              </div>
              <div className="hidden sm:block">
                <p className={`text-xs font-semibold ${step === s.n ? "text-gray-900" : "text-gray-400"}`}>{s.label}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200 mx-2" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Basic Information</h3>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Property Name *</label>
              <input value={form.name} onChange={set("name")} placeholder="e.g. Westside Commons, 1400 Main LLC"
                className={fieldClass("name")} />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Property Type *</label>
              <select value={form.type} onChange={set("type")} className={fieldClass("type")}>
                {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Street Address *</label>
              <input value={form.address} onChange={set("address")} placeholder="1425 Brickell Ave"
                className={fieldClass("address")} />
              {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">City *</label>
                <input value={form.city} onChange={set("city")} placeholder="Miami"
                  className={fieldClass("city")} />
                {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">State</label>
                <select value={form.state} onChange={set("state")} className={fieldClass("state")}>
                  {US_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Property Details</h3>

            <div className="grid grid-cols-2 gap-3">
              {form.type === "Multifamily" ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Number of Units</label>
                  <input value={form.units} onChange={set("units")} type="number" placeholder="e.g. 48"
                    className={fieldClass("units")} />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Square Footage</label>
                  <input value={form.sqft} onChange={set("sqft")} type="number" placeholder="e.g. 120000"
                    className={fieldClass("sqft")} />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Year Built</label>
                <input value={form.yearBuilt} onChange={set("yearBuilt")} type="number" placeholder="e.g. 2015"
                  className={fieldClass("yearBuilt")} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Current Occupancy (%) *
              </label>
              <input value={form.occupancy} onChange={set("occupancy")} type="number" min="0" max="100"
                placeholder="e.g. 94"
                className={fieldClass("occupancy")} />
              {errors.occupancy && <p className="text-xs text-red-500 mt-1">{errors.occupancy}</p>}
              <p className="text-xs text-gray-400 mt-1">Enter 0 if the property is vacant.</p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4 mt-2">
              <p className="text-xs font-semibold text-gray-600 mb-1">Why we ask for occupancy</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Occupancy is one of the key inputs for your property health score. We'll track changes over time.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Financials</h3>
            <p className="text-sm text-gray-500 mb-4">Optional — you can add this later or upload financial documents for AI analysis.</p>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Annual NOI (Net Operating Income)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input value={form.noi} onChange={set("noi")} type="number" placeholder="e.g. 850000"
                  className={`${fieldClass("noi")} pl-7`} />
              </div>
              <p className="text-xs text-gray-400 mt-1">Trailing 12 months. Used for DSCR and scoring.</p>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-gray-200 p-4 mt-4">
              <p className="text-xs font-semibold text-gray-600 mb-3">Property Summary</p>
              <div className="space-y-2">
                {[
                  { label: "Name", value: form.name },
                  { label: "Type", value: form.type },
                  { label: "Address", value: `${form.address}, ${form.city}, ${form.state}` },
                  { label: form.type === "Multifamily" ? "Units" : "Sq Ft", value: form.units || form.sqft || "—" },
                  { label: "Occupancy", value: form.occupancy ? `${form.occupancy}%` : "—" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{row.label}</span>
                    <span className="font-medium text-gray-900">{row.value || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          {step > 1 ? (
            <button onClick={back} className="text-sm font-medium text-gray-500 hover:text-gray-900 px-4 py-2 rounded-xl hover:bg-gray-50 transition">
              Back
            </button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <button onClick={next}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Continue →
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
              style={{ background: "#800020" }}>
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : "Add Property ✓"}
            </button>
          )}
        </div>
      </div>

      {/* Skip link for step 3 */}
      {step === 3 && (
        <p className="text-center mt-3 text-xs text-gray-400">
          Financials are optional.{" "}
          <button onClick={handleSave} className="underline hover:text-gray-600">
            Skip and save property
          </button>
        </p>
      )}
    </div>
  );
}
