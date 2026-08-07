import React, { useState, useEffect } from "react";
import { API_BASE } from "../../lib/apiBase";

const ACCENT = "#800020";

// ── Platform boundary disclosure (required on every render) ──────────────────
const DISCLOSURE = "Kontra provides software for transaction coordination, document organization, verification support, and digital-asset preparation. Kontra does not provide legal, investment, brokerage, issuance, custody, money-transmission, or regulatory services. Readiness indicators measure workspace completion and do not constitute legal approval or eligibility for issuance.";

// ── Draft token field disclaimer ─────────────────────────────────────────────
const DRAFT_DISCLAIMER = "Draft information supplied by the workspace owner. Kontra does not structure, recommend, approve, issue, or sell digital assets.";

const READINESS_STATUSES = [
  "Preparation incomplete",
  "Information collected",
  "Awaiting professional review",
  "Ready for external review",
  "Package prepared for handoff",
];

const SECTIONS = [
  {
    key: "asset_record",
    icon: "🏢",
    label: "Asset Record",
    description: "Confirm the asset or company identity, supporting documents, and verification status.",
    fields: [
      { key: "da_asset_identity",       label: "Asset / entity name confirmed" },
      { key: "da_asset_type",           label: "Asset type documented" },
      { key: "da_ownership_entity",     label: "Ownership entity identified" },
      { key: "da_supporting_docs",      label: "Supporting documents uploaded" },
      { key: "da_valuation_docs",       label: "Valuation documents uploaded" },
      { key: "da_encumbrances",         label: "Encumbrances reviewed" },
      { key: "da_verification_status",  label: "Verification status reviewed" },
    ],
  },
  {
    key: "ownership_governance",
    icon: "👤",
    label: "Ownership & Governance",
    description: "Document legal ownership, beneficial owners, and governing structure.",
    fields: [
      { key: "da_legal_owner",          label: "Legal owner documented" },
      { key: "da_beneficial_owners",    label: "Beneficial owners identified" },
      { key: "da_cap_table",            label: "Existing cap table uploaded" },
      { key: "da_governing_docs",       label: "Governing documents uploaded" },
      { key: "da_required_approvals",   label: "Required approvals identified" },
      { key: "da_transfer_restrictions",label: "Transfer restrictions documented" },
    ],
  },
  {
    key: "legal_preparation",
    icon: "⚖️",
    label: "Legal Preparation",
    description: "Organize legal materials. Jurisdiction and exemption selection must be made by your counsel.",
    fields: [
      { key: "da_jurisdiction",         label: "Proposed jurisdiction entered by counsel" },
      { key: "da_counsel_assigned",     label: "Legal counsel assigned" },
      { key: "da_legal_analysis",       label: "Legal analysis uploaded" },
      { key: "da_offering_docs",        label: "Offering documents uploaded" },
      { key: "da_entity_structure",     label: "Entity structure documented" },
      { key: "da_disclosures",          label: "Required disclosures tracked" },
    ],
    disclaimer: "Kontra does not determine whether an asset is a security, does not select the legal exemption, and does not provide legal advice.",
  },
  {
    key: "compliance_preparation",
    icon: "🛡️",
    label: "Compliance Preparation",
    description: "Select external providers for KYC, AML, and accreditation. Kontra displays statuses returned by those providers.",
    fields: [
      { key: "da_kyc_provider",         label: "KYC provider selected" },
      { key: "da_aml_provider",         label: "AML provider selected" },
      { key: "da_accreditation",        label: "Accreditation / eligibility provider selected" },
      { key: "da_sanctions_screening",  label: "Sanctions screening status confirmed" },
      { key: "da_policies_uploaded",    label: "Required policies uploaded" },
      { key: "da_compliance_reviewer",  label: "Compliance reviewer assigned" },
    ],
    disclaimer: "Kontra does not perform or certify regulated compliance activities.",
  },
  {
    key: "issuance_preparation",
    icon: "🔷",
    label: "Issuance Preparation",
    description: "Identify external providers and record draft token structure. Complete sections 1–4 first.",
    fields: [
      { key: "da_issuance_provider",    label: "External issuance provider identified" },
      { key: "da_transfer_agent",       label: "External transfer agent / registry identified" },
      { key: "da_custodian",            label: "External custodian identified" },
      { key: "da_proposed_network",     label: "Proposed network noted" },
      { key: "da_token_structure",      label: "Proposed token structure noted" },
    ],
    // Token economics shown last, with draft disclaimer
    draftFields: [
      { key: "da_token_name",   label: "Draft token name",         placeholder: "e.g. Meridian Token" },
      { key: "da_token_symbol", label: "Draft ticker symbol",      placeholder: "e.g. MER" },
      { key: "da_total_supply", label: "Draft total supply",       placeholder: "e.g. 10,000,000" },
      { key: "da_token_price",  label: "Draft token price (USD)",  placeholder: "e.g. $1.00" },
      { key: "da_raise_target", label: "Draft raise target (USD)", placeholder: "e.g. $5,000,000" },
    ],
  },
];

function CheckItem({ itemKey, label, checked, onChange, disabled }) {
  return (
    <label className={`flex items-center gap-3 py-2 cursor-pointer group ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <span
        onClick={() => !disabled && onChange(!checked)}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${
          checked ? "border-green-500 bg-green-500" : "border-gray-300 group-hover:border-gray-400"
        }`}>
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className={`text-xs leading-snug ${checked ? "text-gray-500 line-through" : "text-gray-700"}`}>{label}</span>
    </label>
  );
}

function SectionCard({ section, meta, isEditable, onMetaChange, sectionIndex, priorSectionsComplete }) {
  const [open, setOpen] = useState(sectionIndex === 0);
  const fields = section.fields || [];
  const checkedCount = fields.filter(f => meta[f.key] === "true").length;
  const allChecked = checkedCount === fields.length && fields.length > 0;
  const isLocked = sectionIndex > 0 && !priorSectionsComplete;

  const statusLabel = allChecked
    ? "Information collected"
    : checkedCount > 0
      ? "Preparation incomplete"
      : "Preparation incomplete";

  const statusColor = allChecked ? "#15803d" : "#92400e";
  const statusBg    = allChecked ? "#f0fdf4" : "#fffbeb";

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden transition ${
      isLocked ? "border-gray-100 opacity-60" : "border-gray-200"
    }`}>
      <button
        onClick={() => !isLocked && setOpen(o => !o)}
        disabled={isLocked}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition disabled:pointer-events-none">
        <div className="flex items-center gap-3">
          <span className="text-base">{section.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{section.label}</p>
              {isLocked && <span className="text-[10px] text-gray-400">Complete prior sections first</span>}
            </div>
            <p className="text-[10px] mt-0.5 font-medium" style={{ color: statusColor }}>
              {statusLabel} · {checkedCount}/{fields.length} items
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {allChecked && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#f0fdf4", color: "#15803d" }}>
              ✓ Complete
            </span>
          )}
          {!isLocked && (
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {open && !isLocked && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-1">
          <p className="text-xs text-gray-500 leading-relaxed mb-3">{section.description}</p>
          {fields.map(f => (
            <CheckItem
              key={f.key}
              itemKey={f.key}
              label={f.label}
              checked={meta[f.key] === "true"}
              onChange={val => onMetaChange(f.key, val ? "true" : "")}
              disabled={!isEditable}
            />
          ))}
          {section.disclaimer && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
              <p className="text-[10px] text-amber-700 leading-relaxed">{section.disclaimer}</p>
            </div>
          )}
          {/* Draft token economics — gated behind all prior sections */}
          {section.draftFields && isEditable && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 mb-3">
                <p className="text-[10px] text-gray-500 leading-relaxed">{DRAFT_DISCLAIMER}</p>
              </div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Draft Token Economics</p>
              <div className="space-y-2">
                {section.draftFields.map(df => (
                  <div key={df.key}>
                    <label className="text-[10px] font-medium text-gray-500 mb-0.5 block">{df.label}</label>
                    <input
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-800/20"
                      value={meta[df.key] || ""}
                      onChange={e => onMetaChange(df.key, e.target.value)}
                      placeholder={df.placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DigitalAssetReadinessWorkflow({ propertyId, property, onClose }) {
  const [meta, setMeta] = useState({});
  const [ownerToken, setOwnerToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    try { setOwnerToken(localStorage.getItem(`kontra_owner_token_${propertyId}`) || ""); } catch {}
  }, [propertyId]);

  // Seed meta from property.metadata_values
  useEffect(() => {
    if (property?.metadata_values) setMeta({ ...(property.metadata_values || {}) });
  }, [property]);

  const isEditable = Boolean(ownerToken);

  // Compute section completion for gating
  const sectionComplete = SECTIONS.map(s => {
    const fields = s.fields || [];
    if (fields.length === 0) return true;
    return fields.every(f => meta[f.key] === "true");
  });

  function handleMetaChange(key, value) {
    setMeta(prev => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!ownerToken) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/metadata-merge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: meta, ownerWriteToken: ownerToken }),
      });
      if (res.ok) { setSaveMsg("Saved"); setTimeout(() => setSaveMsg(""), 2000); }
    } finally { setSaving(false); }
  }

  // Compute overall readiness label
  const totalItems = SECTIONS.flatMap(s => s.fields).length;
  const checkedItems = SECTIONS.flatMap(s => s.fields).filter(f => meta[f.key] === "true").length;
  const readinessPct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
  const readinessLabel = readinessPct === 100
    ? "Package prepared for handoff"
    : readinessPct >= 75
      ? "Ready for external review"
      : readinessPct >= 50
        ? "Awaiting professional review"
        : readinessPct > 0
          ? "Information collected"
          : "Preparation incomplete";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔷</span>
            <div>
              <p className="text-sm font-bold text-gray-900">Digital Asset Readiness</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Preparation for external digital issuance providers · Not legal advice
              </p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose}
              className="text-xs font-medium text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition">
              ← Back
            </button>
          )}
        </div>

        {/* Readiness bar */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${readinessPct}%`, background: readinessPct === 100 ? "#22c55e" : ACCENT }} />
          </div>
          <p className="text-xs font-semibold text-gray-700 shrink-0">{checkedItems}/{totalItems} items</p>
        </div>
        <p className="text-[10px] font-medium" style={{ color: readinessPct === 100 ? "#15803d" : "#92400e" }}>
          {readinessLabel}
        </p>
      </div>

      {/* Required disclosure */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
        <p className="text-[10px] text-gray-500 leading-relaxed">{DISCLOSURE}</p>
      </div>

      {/* Sections */}
      {SECTIONS.map((section, idx) => (
        <SectionCard
          key={section.key}
          section={section}
          meta={meta}
          isEditable={isEditable}
          onMetaChange={handleMetaChange}
          sectionIndex={idx}
          priorSectionsComplete={idx === 0 || sectionComplete.slice(0, idx).every(Boolean)}
        />
      ))}

      {/* Save + Export */}
      {isEditable && (
        <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
          <p className="text-xs font-semibold text-gray-700 mb-3">Handoff</p>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            When preparation is complete, export this package to send to your external legal,
            compliance, or issuance provider.
          </p>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="text-xs font-bold px-4 py-2 rounded-xl text-white disabled:opacity-50 transition hover:opacity-90"
              style={{ background: ACCENT }}>
              {saving ? "Saving…" : saveMsg || "Save progress"}
            </button>
            <button
              onClick={() => {
                setExporting(true);
                setTimeout(() => setExporting(false), 1500);
                alert("Export Preparation Package — PDF/JSON export coming soon. Your external provider can also be sent this workspace link directly.");
              }}
              disabled={exporting}
              className="text-xs font-bold px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
              {exporting ? "Preparing…" : "Export Preparation Package"}
            </button>
          </div>
        </div>
      )}

      {!isEditable && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-center">
          <p className="text-xs text-gray-400">Read-only view. Owner access required to edit.</p>
        </div>
      )}
    </div>
  );
}
