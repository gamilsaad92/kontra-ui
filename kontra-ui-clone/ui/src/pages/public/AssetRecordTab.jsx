import React, { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../../lib/apiBase";

const ACCENT = "#800020";

const CATEGORIES = [
  { key: "transaction",          label: "Transaction",              icon: "📋" },
  { key: "asset_identity",       label: "Asset / Company",         icon: "🏢" },
  { key: "parties",              label: "Parties",                 icon: "🤝" },
  { key: "beneficial_ownership", label: "Ownership",               icon: "👤" },
  { key: "financial",            label: "Financial",               icon: "📊" },
  { key: "legal",                label: "Legal",                   icon: "⚖️"  },
  { key: "approvals",            label: "Approvals",               icon: "✅" },
];

const STATUS_CONFIG = {
  missing:        { label: "Missing",                bg: "#f3f4f6", text: "#6b7280", dot: "#d1d5db" },
  extracted:      { label: "Extracted — review",     bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
  needs_review:   { label: "Needs Review",           bg: "#fffbeb", text: "#92400e", dot: "#f59e0b" },
  verified:       { label: "Confirmed",              bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
  conflicting:    { label: "Conflicting",            bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" },
  source_changed: { label: "Source Changed",         bg: "#fdf4ff", text: "#7e22ce", dot: "#a855f7" },
  not_applicable: { label: "N/A",                    bg: "#f9fafb", text: "#9ca3af", dot: "#e5e7eb" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.missing;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: cfg.bg, color: cfg.text }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function FieldRow({ field, isCoordinator, propertyId, ownerToken, onUpdated }) {
  const [editing, setEditing]   = useState(false);
  const [editVal, setEditVal]   = useState(field.value_text || "");
  const [editNotes, setEditNotes] = useState(field.notes || "");
  const [saving, setSaving]     = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function saveField() {
    if (!ownerToken) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields/${field.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            value_text: editVal,
            notes: editNotes,
            status: "needs_review",
            ownerWriteToken: ownerToken,
          }),
        }
      );
      if (res.ok) { onUpdated(); setEditing(false); }
    } finally { setSaving(false); }
  }

  async function verifyField() {
    if (!ownerToken) return;
    setVerifying(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields/${field.id}/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerWriteToken: ownerToken, actorRole: "Deal Coordinator" }),
        }
      );
      if (res.ok) onUpdated();
    } finally { setVerifying(false); }
  }

  async function markNA() {
    if (!ownerToken) return;
    await fetch(
      `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields/${field.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "not_applicable", ownerWriteToken: ownerToken }),
      }
    );
    onUpdated();
  }

  const isEmpty     = !field.value_text && !field.value_json;
  const isConfirmed = field.status === "verified";
  const isNA        = field.status === "not_applicable";

  // Build a human-readable "confirmed by" line showing role + actor
  function confirmedByLine() {
    if (!field.verified_at) return null;
    const role  = field.verified_role || "Participant";
    const by    = field.verified_by   || "";
    const date  = new Date(field.verified_at).toLocaleDateString();
    return `Confirmed by ${role}${by ? ` (${by})` : ""} · ${date}`;
  }

  return (
    <div className={`border-b border-gray-50 last:border-0 px-5 py-3.5 ${isNA ? "opacity-40" : ""}`}>
      {!editing ? (
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-xs font-semibold text-gray-700 shrink-0">{field.display_label}</p>
              <StatusBadge status={field.status} />
              {field.confidence != null && field.status === "extracted" && (
                <span className="text-[10px] text-gray-400">{Math.round(field.confidence * 100)}% confidence</span>
              )}
            </div>
            {isEmpty ? (
              <p className="text-xs text-gray-400 italic">Not yet collected</p>
            ) : (
              <p className="text-xs text-gray-800 leading-relaxed">{field.value_text}</p>
            )}
            {field.source_doc_id && field.source_page && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Source: {field.source_excerpt ? `"${field.source_excerpt.slice(0, 60)}…"` : "Document"} — p.{field.source_page}
              </p>
            )}
            {field.status === "source_changed" && (
              <p className="text-[10px] text-purple-600 mt-0.5">
                Previously confirmed — newer source document requires review
              </p>
            )}
            {field.notes && (
              <p className="text-[10px] text-gray-500 italic mt-0.5">Note: {field.notes}</p>
            )}
            {isConfirmed && confirmedByLine() && (
              <p className="text-[10px] text-green-600 mt-0.5">{confirmedByLine()}</p>
            )}
          </div>
          {isCoordinator && !isNA && (
            <div className="flex items-center gap-1.5 shrink-0">
              {!isConfirmed && !isEmpty && (
                <button onClick={verifyField} disabled={verifying}
                  className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-1 rounded-lg hover:bg-green-100 transition disabled:opacity-50">
                  {verifying ? "…" : "Confirm"}
                </button>
              )}
              <button onClick={() => { setEditVal(field.value_text || ""); setEditNotes(field.notes || ""); setEditing(true); }}
                className="text-[10px] font-medium text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition">
                Edit
              </button>
              {!isEmpty && (
                <button onClick={markNA}
                  className="text-[10px] font-medium text-gray-300 hover:text-gray-500 px-1 py-1 rounded-lg hover:bg-gray-100 transition">
                  N/A
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">{field.display_label}</p>
          <input
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-800/30"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            placeholder="Enter value…"
            autoFocus
          />
          <input
            className="w-full text-xs border border-gray-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-800/20 text-gray-500"
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            placeholder="Notes (optional)…"
          />
          <div className="flex gap-2">
            <button onClick={saveField} disabled={saving}
              className="text-xs font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 transition"
              style={{ background: ACCENT }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategorySection({ category, fields, isCoordinator, propertyId, ownerToken, onUpdated, workspaceSeededFields }) {
  const [open, setOpen] = useState(true);
  const catFields       = fields.filter(f => f.field_category === category.key);
  const confirmedCount  = catFields.filter(f => f.status === "verified").length;
  const total           = catFields.length;

  // Workspace-seeded preview items shown when no extracted fields exist for this category
  const seeded = (workspaceSeededFields || []).filter(s => s.category === category.key);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition">
        <div className="flex items-center gap-3">
          <span className="text-base">{category.icon}</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{category.label}</p>
            {total > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {confirmedCount}/{total} confirmed
              </p>
            )}
            {total === 0 && seeded.length > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">{seeded.length} from workspace setup</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${(confirmedCount / total) * 100}%`, background: confirmedCount === total ? "#22c55e" : ACCENT }} />
            </div>
          )}
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100">
          {catFields.length === 0 && seeded.length === 0 ? (
            <p className="px-5 py-4 text-xs text-gray-400 italic">
              No information collected yet. Upload documents to extract fields automatically.
            </p>
          ) : catFields.length === 0 && seeded.length > 0 ? (
            // Show workspace-seeded fields as placeholder rows
            <div>
              {seeded.map(s => (
                <div key={s.label} className="border-b border-gray-50 last:border-0 px-5 py-3">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-xs font-semibold text-gray-700 shrink-0">{s.label}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-blue-50 text-blue-600">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-blue-400" />
                      From setup
                    </span>
                  </div>
                  {s.value
                    ? <p className="text-xs text-gray-800">{s.value}</p>
                    : <p className="text-xs text-gray-400 italic">Missing</p>
                  }
                </div>
              ))}
              <p className="px-5 py-2.5 text-[10px] text-gray-400 italic border-t border-gray-50">
                Upload documents in the Documents tab — Kontra will extract additional fields automatically.
              </p>
            </div>
          ) : (
            catFields.map(f => (
              <FieldRow key={f.id} field={f} isCoordinator={isCoordinator}
                propertyId={propertyId} ownerToken={ownerToken} onUpdated={onUpdated} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Build workspace-seeded field list from setup metadata, shown before documents are uploaded
function buildSeededFields(workspaceMeta) {
  const m = workspaceMeta || {};
  return [
    // Transaction category
    { category: "transaction", label: "Transaction type",  value: m.deal_type         ? String(m.deal_type).replace(/_/g, " ") : null },
    { category: "transaction", label: "Current stage",     value: m.stage             ? String(m.stage).replace(/_/g, " ")     : null },
    { category: "transaction", label: "Target closing date",value: m.closing_date     || null },
    { category: "transaction", label: "Transaction value", value: m.transaction_value ? `$${Number(m.transaction_value).toLocaleString()}` : null },
    { category: "transaction", label: "Workflow pack",     value: m.pack_name         || null },
    // Asset / Company category
    { category: "asset_identity", label: "Workspace name",  value: m.name             || null },
    { category: "asset_identity", label: "Jurisdiction",    value: m.jurisdiction      || null },
  ];
}

export default function AssetRecordTab({
  propertyId, isCoordinator,
  isTokenizationRelevant, daReadinessEnabled,
  onEnableDAReadiness, onOpenDAReadiness,
  workspaceMeta,
}) {
  const [fields,      setFields]     = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [ownerToken,  setOwnerToken] = useState("");
  const [refreshKey,  setRefreshKey] = useState(0);
  const [extracting,  setExtracting] = useState(false);
  const [enablingDA,  setEnablingDA] = useState(false);

  useEffect(() => {
    try { setOwnerToken(localStorage.getItem(`kontra_owner_token_${propertyId}`) || ""); } catch {}
  }, [propertyId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/transaction-record`, {
        headers: ownerToken ? { "x-owner-write-token": ownerToken } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setFields(data.fields || []);
      }
    } finally { setLoading(false); }
  }, [propertyId, ownerToken]);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function triggerExtract() {
    if (!ownerToken) return;
    setExtracting(true);
    try {
      await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerWriteToken: ownerToken }),
      });
      setTimeout(() => setRefreshKey(k => k + 1), 1500);
    } finally { setExtracting(false); }
  }

  async function handleEnableDA() {
    if (!onEnableDAReadiness) return;
    setEnablingDA(true);
    try { await onEnableDAReadiness(); } finally { setEnablingDA(false); }
  }

  const totalFields    = fields.length;
  const confirmedCount = fields.filter(f => f.status === "verified").length;
  const extractedCount = fields.filter(f => f.status === "extracted" || f.status === "needs_review").length;
  const missingCount   = fields.filter(f => f.status === "missing").length;
  const pct = totalFields > 0 ? Math.round((confirmedCount / totalFields) * 100) : 0;

  const seededFields = buildSeededFields(workspaceMeta);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="h-4 w-40 bg-gray-100 rounded animate-pulse mb-2" />
            <div className="h-3 w-64 bg-gray-50 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-gray-900">Transaction Record</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Structured information extracted from documents and confirmed by participants.
              Kontra does not certify or legally verify any field.
            </p>
          </div>
          {isCoordinator && totalFields > 0 && (
            <button onClick={triggerExtract} disabled={extracting}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50 shrink-0">
              {extracting ? "Extracting…" : "Re-extract"}
            </button>
          )}
        </div>
        {totalFields > 0 && (
          <>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct === 100 ? "#22c55e" : ACCENT }} />
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-700 shrink-0">{confirmedCount}/{totalFields} confirmed</p>
            </div>
            <div className="flex gap-3 mt-2">
              {confirmedCount > 0 && <span className="text-[10px] text-green-600">{confirmedCount} confirmed</span>}
              {extractedCount > 0 && <span className="text-[10px] text-blue-600">{extractedCount} awaiting review</span>}
              {missingCount   > 0 && <span className="text-[10px] text-gray-400">{missingCount} missing</span>}
            </div>
          </>
        )}
        {totalFields === 0 && (
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
            <span>{seededFields.filter(s => s.value).length} fields from workspace setup</span>
            <span>·</span>
            <span>0 extracted from documents</span>
            <span>·</span>
            <span>0 confirmed by participants</span>
          </div>
        )}
      </div>

      {/* Category sections — always shown; seeded fields appear before documents arrive */}
      {CATEGORIES.map(cat => (
        <CategorySection
          key={cat.key}
          category={cat}
          fields={fields}
          isCoordinator={isCoordinator}
          propertyId={propertyId}
          ownerToken={ownerToken}
          onUpdated={() => setRefreshKey(k => k + 1)}
          workspaceSeededFields={seededFields}
        />
      ))}

      {/* Digital Asset Readiness entry */}
      {isTokenizationRelevant && !daReadinessEnabled && isCoordinator && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-base">🔷</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Optional: Digital Asset Readiness</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  This transaction may benefit from a Digital Asset Readiness workflow —
                  organizing information for potential review by external legal, compliance,
                  issuance, custody, or settlement providers.
                </p>
                <p className="text-[10px] text-gray-400 mt-1 italic">
                  AI suggestion only. You decide whether this applies.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEnableDA}
                disabled={enablingDA}
                className="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: ACCENT }}>
                {enablingDA ? "Enabling…" : "Add preparation workflow"}
              </button>
              <button
                className="text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
                Not needed
              </button>
            </div>
          </div>
        </div>
      )}

      {isTokenizationRelevant && daReadinessEnabled && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-base">🔷</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">Digital Asset Readiness</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Preparation workflow enabled · Organize for external provider review
                </p>
              </div>
            </div>
            {isCoordinator && onOpenDAReadiness && (
              <button onClick={onOpenDAReadiness}
                className="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition hover:opacity-90 shrink-0"
                style={{ background: ACCENT }}>
                Open →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
