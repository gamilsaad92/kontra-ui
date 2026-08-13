import React, { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../../lib/apiBase";
import { buildSeededFromSchema, getSummaryFieldKeys, resolveSchemaKey } from "../../lib/workflowPacks/transactionRecordSchema";

const ACCENT = "#800020";

const CATEGORIES = [
  { key: "transaction",          label: "Transaction",     icon: "📋", defaultOpen: true  },
  { key: "asset_identity",       label: "Asset / Company", icon: "🏢", defaultOpen: true  },
  { key: "parties",              label: "Parties",         icon: "🤝", defaultOpen: false },
  { key: "beneficial_ownership", label: "Ownership",       icon: "👤", defaultOpen: false },
  { key: "financial",            label: "Financial",       icon: "📊", defaultOpen: false },
  { key: "legal",                label: "Legal",           icon: "⚖️", defaultOpen: false },
  { key: "approvals",            label: "Approvals",       icon: "✅", defaultOpen: false },
];

const STATUS_CONFIG = {
  missing:        { label: "Missing",                     bg: "#f3f4f6", text: "#6b7280", dot: "#d1d5db" },
  extracted:      { label: "Extracted — review",          bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
  needs_review:   { label: "Needs Review",                bg: "#fffbeb", text: "#92400e", dot: "#f59e0b" },
  verified:       { label: "Confirmed",                   bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
  conflicting:    { label: "Conflicting",                 bg: "#fef2f2", text: "#991b1b", dot: "#ef4444" },
  source_changed: { label: "Source Changed",              bg: "#fdf4ff", text: "#7e22ce", dot: "#a855f7" },
  not_applicable: { label: "N/A",                         bg: "#f9fafb", text: "#9ca3af", dot: "#e5e7eb" },
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

function formatHistoryEvent(event) {
  const labels = {
    extracted: "Extracted from document",
    manual_edit: "Entered or edited manually",
    confirmed: "Confirmed",
    marked_not_applicable: "Marked not applicable",
    conflict: "Conflicting source detected",
    source_changed: "Source changed after confirmation",
  };
  return labels[event] || event;
}

function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)} onBlur={() => setShow(false)}
        className="text-gray-300 hover:text-gray-500 transition ml-1" aria-label="More information">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </button>
      {show && (
        <div className="absolute left-0 bottom-full mb-1.5 z-50 w-64 rounded-xl bg-gray-800 text-white text-[10px] leading-relaxed px-3 py-2 shadow-lg pointer-events-none">
          {text}
        </div>
      )}
    </div>
  );
}

function normalizedValue(value) {
  return String(value || "").trim().toLowerCase();
}

function dependencyIsInactive(field, dbFields, seededFields) {
  const dependency = field?.dependsOn;
  if (!dependency?.field) return false;
  const dbDependency = dbFields.find(item => item.field_key === dependency.field);
  const seededDependency = seededFields.find(item => item.key === dependency.field);
  const value = dbDependency?.value_text || seededDependency?.value || "";
  if (dbDependency?.status === "not_applicable") return true;
  return (dependency.inactiveWhen || []).some(candidate =>
    normalizedValue(value) === normalizedValue(candidate)
  );
}

function schemaFieldForDbField(dbField, allSchemaFields = []) {
  // Prefer an exact schema key over an alias whose canonicalKey happens to
  // match. Without this, transaction.purchase_price can be resolved as the
  // earlier transaction.value alias and then hidden as if it were a duplicate.
  return allSchemaFields.find(field => field.key === dbField?.field_key)
    || allSchemaFields.find(field =>
      !field.aliasOf && (field.canonicalKey || field.key) === dbField?.field_key
    )
    || allSchemaFields.find(field =>
      (field.canonicalKey || field.key) === dbField?.field_key
    )
    || null;
}

function dbFieldMatchesSchema(dbField, schemaField, allSchemaFields = []) {
  if (!schemaField) return false;
  const canonicalKey = schemaField.canonicalKey || schemaField.key;
  return dbField.field_key === schemaField.key ||
    dbField.field_key === canonicalKey ||
    allSchemaFields.some(field =>
      field.aliasOf === canonicalKey && field.key === dbField.field_key
    );
}

function canonicalFieldValue(schemaField, dbFields, allSchemaFields = []) {
  const matches = dbFields
    .filter(item => dbFieldMatchesSchema(item, schemaField, allSchemaFields))
    .sort((a, b) => {
      const aCanonical = a.field_key === schemaField?.canonicalKey || a.field_key === schemaField?.key;
      const bCanonical = b.field_key === schemaField?.canonicalKey || b.field_key === schemaField?.key;
      const aHasValue = Boolean(a.value_text || a.value_json);
      const bHasValue = Boolean(b.value_text || b.value_json);
      return Number(bCanonical) - Number(aCanonical) || Number(bHasValue) - Number(aHasValue);
    });
  const match = matches[0];
  return match?.value_text || match?.value_json || null;
}

const SUMMARY_EXCEPTION_STATUSES = new Set([
  "conflicting", "source_changed", "rejected", "overdue", "blocked",
]);

function isSummaryException(field) {
  if (!field) return false;
  if (SUMMARY_EXCEPTION_STATUSES.has(String(field.status || "").toLowerCase())) return true;
  if (SUMMARY_EXCEPTION_STATUSES.has(String(field.confirmation_status || "").toLowerCase())) return true;
  if (SUMMARY_EXCEPTION_STATUSES.has(String(field.request_status || "").toLowerCase())) return true;
  if (field.rejected || field.overdue || field.request_overdue || field.blocked || field.is_blocked) return true;
  return Boolean((field.critical || field.is_critical || field.missing_critical) &&
    !field.value_text && !field.value_json);
}

function isMaterialSummaryDbField(field, seededFields, summaryKeys) {
  const schema = schemaFieldForDbField(field, seededFields);
  const canonicalKey = schema?.canonicalKey || field?.field_key;
  const materialApproval = schema?.category === "approvals" &&
    field?.status !== "not_applicable";
  return schema?.summaryPriority === "key" ||
    summaryKeys.has(canonicalKey) ||
    materialApproval ||
    isSummaryException(field);
}

function isSummarySchemaField(field, summaryKeys) {
  return field?.summaryPriority === "key" ||
    summaryKeys?.has(field?.canonicalKey || field?.key);
}

function canonicalRecordKey(field, seededFields) {
  const schema = schemaFieldForDbField(field, seededFields);
  return schema?.canonicalKey || field?.field_key;
}

function uniqueCanonicalFields(fields, seededFields) {
  const result = [];
  const positions = new Map();
  for (const field of fields) {
    const key = field.key ? (field.canonicalKey || field.key) : canonicalRecordKey(field, seededFields);
    if (!key) continue;
    const existingIndex = positions.get(key);
    if (existingIndex == null) {
      positions.set(key, result.length);
      result.push(field);
      continue;
    }
    const existing = result[existingIndex];
    const fieldIsCanonical = field.key
      ? !field.aliasOf
      : !schemaFieldForDbField(field, seededFields)?.aliasOf;
    const existingIsCanonical = existing.key
      ? !existing.aliasOf
      : !schemaFieldForDbField(existing, seededFields)?.aliasOf;
    if (fieldIsCanonical && !existingIsCanonical) result[existingIndex] = field;
  }
  return result;
}

function getRecordStats(
  schemaFields,
  dbFields,
  seededFields,
  includeDb = () => true,
  isInactive = () => false,
  includeUnknownDb = true,
) {
  const byKey = new Map();
  uniqueCanonicalFields(schemaFields, seededFields).forEach(field => {
    byKey.set(field.key ? (field.canonicalKey || field.key) : canonicalRecordKey(field, seededFields), {
      seeded: field,
      db: null,
    });
  });
  uniqueCanonicalFields(dbFields, seededFields).filter(includeDb).forEach(field => {
    const key = canonicalRecordKey(field, seededFields);
    const existing = byKey.get(key);
    if (existing) existing.db = field;
    else if (includeUnknownDb) byKey.set(key, { seeded: null, db: field });
  });

  let awaiting = 0;
  let extracted = 0;
  let confirmed = 0;
  let manuallyEntered = 0;
  let fromSetup = 0;
  let notApplicable = 0;
  for (const { seeded, db } of byKey.values()) {
    if (isInactive(seeded, db)) {
      notApplicable++;
      continue;
    }
    if (db?.status === "not_applicable") {
      notApplicable++;
    } else if (db?.status === "verified") {
      confirmed++;
    } else if (["coordinator", "deal_owner"].includes(db?.extracted_by) && (db.value_text || db.value_json)) {
      manuallyEntered++;
    } else if ((db?.status === "extracted" || db?.status === "needs_review") &&
      (db.value_text || db.value_json)) {
      extracted++;
    } else if (seeded?.value && !db) {
      fromSetup++;
    } else if (db || !seeded?.value) {
      awaiting++;
    }
  }
  const fieldCount = byKey.size;
  const total = Math.max(0, fieldCount - notApplicable);
  return {
    total,
    fieldCount,
    awaiting,
    extracted,
    confirmed,
    manuallyEntered,
    fromSetup,
    complete: confirmed + extracted + manuallyEntered + fromSetup,
    notApplicable,
  };
}

// ── DB-backed field row (has a real ID) ───────────────────────────────────────
function FieldRow({ field, isCoordinator, propertyId, ownerToken, onUpdated, dependencyInactive = false }) {
  const [editing,   setEditing]   = useState(false);
  const [editVal,   setEditVal]   = useState(field.value_text || "");
  const [editNotes, setEditNotes] = useState(field.notes || "");
  const [saving,    setSaving]    = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);

  async function loadHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (history.length > 0) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields/${field.id}/history`,
        { headers: ownerToken ? { "x-owner-write-token": ownerToken } : {} }
      );
      if (res.ok) setHistory((await res.json()).history || []);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveField() {
    if (!ownerToken) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields/${field.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value_text: editVal, notes: editNotes, status: "needs_review", ownerWriteToken: ownerToken }) }
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
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerWriteToken: ownerToken, actorRole: "Deal Coordinator" }) }
      );
      if (res.ok) onUpdated();
    } finally { setVerifying(false); }
  }

  async function markNA() {
    if (!ownerToken) return;
    await fetch(
      `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields/${field.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "not_applicable", ownerWriteToken: ownerToken }) }
    );
    onUpdated();
  }

  const isEmpty     = !field.value_text && !field.value_json;
  const isConfirmed = field.status === "verified";
  const isNA        = field.status === "not_applicable";
  const isInactive  = dependencyInactive && !isConfirmed;

  function confirmedByLine() {
    if (!field.verified_at) return null;
    const role = field.verified_role || "Participant";
    const by   = field.verified_by   || "";
    const date = new Date(field.verified_at).toLocaleDateString();
    return `Confirmed by ${role}${by ? ` (${by})` : ""} · ${date}`;
  }

  return (
    <div className={`border-b border-gray-50 last:border-0 px-5 py-3.5 ${isNA || isInactive ? "opacity-40" : ""}`}>
      {!editing ? (
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-xs font-semibold text-gray-700 shrink-0">{field.display_label}</p>
              <StatusBadge status={isInactive ? "not_applicable" : field.status} />
              {field.confidence != null && field.status === "extracted" && (
                <span className="text-[10px] text-gray-400">{Math.round(field.confidence * 100)}% confidence</span>
              )}
            </div>
            {isInactive ? (
              <p className="text-xs text-gray-400 italic">Not applicable — the related workflow item is not needed</p>
            ) : isEmpty ? (
              <p className="text-xs text-gray-400 italic">Missing — not yet collected</p>
            ) : (
              <p className="text-xs text-gray-800 leading-relaxed">{field.value_text}</p>
            )}
            {field.source_doc_id && field.source_page && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Source: {field.source_excerpt ? `"${field.source_excerpt.slice(0, 60)}…"` : "Document"} — p.{field.source_page}
              </p>
            )}
            {field.status === "source_changed" && (
              <p className="text-[10px] text-purple-600 mt-0.5 font-medium">
                Previously confirmed — newer source document requires review
              </p>
            )}
            {field.notes && (
              <p className="text-[10px] text-gray-500 italic mt-0.5">Note: {field.notes}</p>
            )}
            {isConfirmed && confirmedByLine() && (
              <p className="text-[10px] text-green-600 mt-0.5">{confirmedByLine()}</p>
            )}
            {historyOpen && (
              <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                {historyLoading ? (
                  <p className="text-[10px] text-gray-400">Loading field history…</p>
                ) : history.length === 0 ? (
                  <p className="text-[10px] text-gray-400">No history recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map(item => (
                      <div key={item.id} className="text-[10px] text-gray-500">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-gray-700">{formatHistoryEvent(item.event_type)}</span>
                          <span>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</span>
                        </div>
                        {(item.prior_value || item.new_value) && (
                          <p className="mt-0.5">
                            {item.prior_value ? `"${item.prior_value}" → ` : ""}{item.new_value || "—"}
                          </p>
                        )}
                        {(item.source_page || item.source_excerpt) && (
                          <p className="text-gray-400">
                            Source{item.source_page ? ` · p.${item.source_page}` : ""}{item.source_excerpt ? ` · "${item.source_excerpt.slice(0, 90)}"` : ""}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {isCoordinator && !isNA && !isInactive && (
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
              <button onClick={loadHistory}
                className="text-[10px] font-medium text-gray-400 hover:text-gray-700 px-1 py-1 rounded-lg hover:bg-gray-100 transition">
                {historyOpen ? "Hide history" : "History"}
              </button>
            </div>
          )}
          {!isCoordinator && (
            <button onClick={loadHistory}
              className="text-[10px] font-medium text-gray-400 hover:text-gray-700 px-1 py-1 rounded-lg hover:bg-gray-100 transition shrink-0">
              {historyOpen ? "Hide history" : "History"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">{field.display_label}</p>
          <input className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-800/30"
            value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="Enter value…" autoFocus />
          <input className="w-full text-xs border border-gray-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-800/20 text-gray-500"
            value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes (optional)…" />
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

// ── Schema field row (no DB record yet) ───────────────────────────────────────
// Shown before documents arrive. Provides contextual actions for each field.
function SeededFieldRow({ field, isCoordinator, propertyId, ownerToken, onUpdated, onRequestUpload, dependencyInactive = false }) {
  const [entering,   setEntering]   = useState(false);
  const [enterVal,   setEnterVal]   = useState("");
  const [enterNotes, setEnterNotes] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [naing,      setNAing]      = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  async function saveManual() {
    if (!ownerToken || !enterVal.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field_key:      field.canonicalKey || field.key,
            display_label:  field.label,
            field_category: field.category,
            value_text:     enterVal.trim(),
            notes:          enterNotes.trim(),
            ownerWriteToken: ownerToken,
          }) }
      );
      if (res.ok) { onUpdated(); setEntering(false); setEnterVal(""); }
    } finally { setSaving(false); }
  }

  async function markNA() {
    if (!ownerToken) return;
    setNAing(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/fields`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field_key:      field.canonicalKey || field.key,
            display_label:  field.label,
            field_category: field.category,
            value_text:     "",
            status:         "not_applicable",
            ownerWriteToken: ownerToken,
          }) }
      );
      if (res.ok) onUpdated();
    } finally { setNAing(false); }
  }

  const hasValue = !!field.value;
  const isInactive = dependencyInactive;

  return (
    <div className={`border-b border-gray-50 last:border-0 px-5 py-3 ${isInactive ? "opacity-40" : ""}`}>
      {!entering ? (
        <div>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className="text-xs font-semibold text-gray-700 shrink-0">{field.label}</p>
                {field.workflowRequired && !hasValue && !isInactive && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded text-amber-700 bg-amber-50 border border-amber-100 shrink-0">
                    Workflow required
                  </span>
                )}
                {!field.workflowRequired && !hasValue && !isInactive && field.requirement === "suggested" && (
                  <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded text-blue-600 bg-blue-50 border border-blue-100 shrink-0">
                    Suggested
                  </span>
                )}
                {hasValue && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-blue-50 text-blue-600">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-blue-400" />
                    From setup
                  </span>
                )}
              </div>
              {isInactive ? (
                <p className="text-xs text-gray-400 italic">Not applicable — the related workflow item is not needed</p>
              ) : hasValue ? (
                <p className="text-xs text-gray-800">{field.value}</p>
              ) : (
                <p className="text-xs text-gray-400">Missing — not yet collected</p>
              )}
              {!hasValue && field.sources?.length > 0 && (
                <p className="text-[10px] text-gray-300 mt-0.5">
                  Expected in: {field.sources.slice(0, 2).join(", ")}{field.sources.length > 2 ? ` +${field.sources.length - 2}` : ""}
                </p>
              )}
            </div>

            {/* Contextual actions — only for empty fields the coordinator can act on */}
            {isCoordinator && !hasValue && ownerToken && !isInactive && (
              <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                {field.sources?.length > 0 && (
                  <button
                    onClick={() => onRequestUpload && onRequestUpload(field.sources[0])}
                    className="text-[10px] font-medium text-gray-500 hover:text-gray-800 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 transition whitespace-nowrap">
                    Upload doc
                  </button>
                )}
                {!requestSent ? (
                  <button
                    onClick={() => setRequestSent(true)}
                    className="text-[10px] font-medium text-gray-500 hover:text-gray-800 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 transition whitespace-nowrap">
                    Request
                  </button>
                ) : (
                  <span className="text-[10px] text-gray-400 px-2">Requested ✓</span>
                )}
                <button
                  onClick={() => setEntering(true)}
                  className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg hover:bg-blue-100 transition whitespace-nowrap">
                  Enter
                </button>
                <button
                  onClick={markNA} disabled={naing}
                  className="text-[10px] font-medium text-gray-300 hover:text-gray-500 px-1.5 py-1 rounded-lg hover:bg-gray-100 transition">
                  N/A
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">{field.label}</p>
          <input
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-800/30"
            value={enterVal} onChange={e => setEnterVal(e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}…`} autoFocus />
          <input
            className="w-full text-xs border border-gray-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-800/20 text-gray-500"
            value={enterNotes} onChange={e => setEnterNotes(e.target.value)}
            placeholder="Notes (optional)…" />
          <div className="flex gap-2 items-center">
            <button onClick={saveManual} disabled={saving || !enterVal.trim()}
              className="text-xs font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-40 transition"
              style={{ background: ACCENT }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setEntering(false); setEnterVal(""); }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-gray-500 bg-gray-100 hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compute per-category chip for collapsed header ────────────────────────────
function getCategoryChip(catKey, dbFields, seededFields, viewMode = "full", summaryKeys = null) {
  const isSummary = viewMode === "summary";
  const isSummaryDbField = field => {
    return !isSummary || isMaterialSummaryDbField(field, seededFields, summaryKeys);
  };
  const dbCat   = uniqueCanonicalFields(
    dbFields.filter(f => f.field_category === catKey && isSummaryDbField(f)),
    seededFields
  );
  const seeded  = uniqueCanonicalFields(seededFields.filter(f =>
    f.category === catKey &&
    f.renderable !== false &&
    (!isSummary || isSummarySchemaField(f, summaryKeys))
  ), seededFields);

  const conflicts     = dbCat.filter(f => f.status === "conflicting" || f.status === "source_changed").length;
  const confirmed     = dbCat.filter(f => f.status === "verified").length;
  const awaitReview   = dbCat.filter(f => f.status === "extracted" || f.status === "needs_review").length;
  const reqMissing    = seeded.filter(f =>
    (isSummary ? true : f.workflowRequired) &&
    !f.value &&
    !dependencyIsInactive(f, dbFields, seededFields) &&
    !dbCat.find(d => dbFieldMatchesSchema(d, f, seededFields) && d.value_text)
  ).length;
  const seededPop     = seeded.filter(f => f.value).length;

  // Priority order for the chip
  if (conflicts > 0)        return { text: `${conflicts} conflict${conflicts > 1 ? "s" : ""}`,                color: "red"   };
  if (reqMissing > 0) {
    const label = isSummary ? "key item" : "workflow item";
    return { text: `${reqMissing} ${label}${reqMissing > 1 ? "s" : ""} missing`, color: "amber" };
  }
  if (awaitReview > 0)      return { text: `${awaitReview} awaiting review`,                                   color: "blue"  };
  if (confirmed > 0 && dbCat.length > 0)
                            return { text: `${confirmed} of ${dbCat.length} confirmed`,                        color: "green" };
  if (dbCat.length > 0)     return { text: `${dbCat.length} collected`,                                       color: "blue"  };
  if (seededPop > 0)        return { text: `${seededPop} from setup`,                                         color: "blue"  };
  return                           { text: "Not started",                                                      color: "gray"  };
}

const CHIP_COLORS = {
  red:   { text: "#991b1b", bg: "#fef2f2", border: "#fecaca" },
  amber: { text: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  blue:  { text: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  green: { text: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  gray:  { text: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb" },
};

function CategoryChip({ chip }) {
  const c = CHIP_COLORS[chip.color] || CHIP_COLORS.gray;
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ color: c.text, background: c.bg, borderColor: c.border }}>
      {chip.text}
    </span>
  );
}

// ── Category section ──────────────────────────────────────────────────────────
function CategorySection({
  category, dbFields, seededFields, isCoordinator, propertyId,
  ownerToken, onUpdated, viewMode, onRequestUpload, summaryKeys,
}) {
  // Auto-expand if category has conflicts or required missing fields
  const seededCat  = seededFields.filter(f =>
    f.category === category.key && f.renderable !== false
  );
  const presentKeys = new Set(dbFields.map(field => field.field_key));
  const dedupedDbFields = dbFields.filter(field => {
    const schemaField = schemaFieldForDbField(field, seededFields);
    const canonicalPresent = schemaField?.aliasOf &&
      field.field_key === schemaField.key &&
      presentKeys.has(schemaField.canonicalKey);
    return !(schemaField?.aliasOf && canonicalPresent);
  });
  const dbCat      = dedupedDbFields.filter(f => f.field_category === category.key);
  const seededWithDependencies = seededCat.map(field => ({
    ...field,
    value: field.value || canonicalFieldValue(field, dbFields, seededFields),
    inactive: dependencyIsInactive(field, dbFields, seededFields),
  }));
  const hasUrgent  = viewMode === "summary"
    ? dbCat.some(isSummaryException)
    : dbCat.some(f => f.status === "conflicting" || f.status === "source_changed")
      || seededWithDependencies.some(f =>
        f.workflowRequired &&
        !f.value &&
        !f.inactive &&
        !dbCat.find(d => dbFieldMatchesSchema(d, f, seededFields) && d.value_text)
      );

  const [open, setOpen] = useState(category.defaultOpen || hasUrgent);

  // Re-evaluate when data changes (first load vs. after documents arrive)
  useEffect(() => {
    if (hasUrgent) setOpen(true);
  }, [hasUrgent]);

  const chip = getCategoryChip(category.key, dbFields, seededFields, viewMode, summaryKeys);

  // Summary view: show only actionable/populated fields
  function shouldShow(dbField) {
    if (viewMode === "full") return true;
    const val = dbField.value_text || dbField.value_json;
    const schema = seededWithDependencies.find(s => dbFieldMatchesSchema(dbField, s, seededFields));
    const canonicalKey = schema?.canonicalKey || dbField.field_key;
    const materialApproval = category.key === "approvals" && !!val;
    return isMaterialSummaryDbField(dbField, seededFields, summaryKeys);
  }

  function shouldShowSeeded(s) {
    if (viewMode === "full") return true;
    const hasCanonicalSeed = s.aliasOf &&
      seededFields.some(field => field.key === s.aliasOf);
    return isSummarySchemaField(s, summaryKeys) && !hasCanonicalSeed;
  }

  const visibleDb     = dbCat.filter(shouldShow);
  const visibleSeeded = seededWithDependencies.filter(shouldShowSeeded);
  const hasSummaryContent = viewMode === "full" || visibleDb.length > 0 || visibleSeeded.length > 0;

  // Progress bar (only when DB fields exist)
  const confirmed = dbCat.filter(f => f.status === "verified").length;
  const total     = dbCat.length;

  if (!hasSummaryContent) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition">
        <div className="flex items-center gap-3">
          <span className="text-base">{category.icon}</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{category.label}</p>
            {!open && (
              <div className="mt-0.5">
                <CategoryChip chip={chip} />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${(confirmed / total) * 100}%`, background: confirmed === total ? "#22c55e" : ACCENT }} />
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
          {dbCat.length > 0 ? (
            // DB-backed fields
            <>
              {visibleDb.length > 0
                ? visibleDb.map(f => (
                    <FieldRow key={f.id} field={f} isCoordinator={isCoordinator}
                      propertyId={propertyId} ownerToken={ownerToken} onUpdated={onUpdated}
                      dependencyInactive={dependencyIsInactive(
                        seededWithDependencies.find(s => dbFieldMatchesSchema(f, s, seededFields)),
                        dbFields,
                        seededFields
                      )} />
                  ))
                : (
                  <p className="px-5 py-3 text-[10px] text-gray-400 italic">
                    {viewMode === "summary" ? "No action needed here — switch to Full Record to see all fields." : "No fields collected yet."}
                  </p>
                )
              }
              {/* Show seeded schema for fields not yet extracted */}
              {visibleSeeded.filter(s => !dbCat.find(d => dbFieldMatchesSchema(d, s, seededFields))).map(s => (
                <SeededFieldRow key={s.key} field={s} isCoordinator={isCoordinator}
                  propertyId={propertyId} ownerToken={ownerToken}
                  onUpdated={onUpdated} onRequestUpload={onRequestUpload}
                  dependencyInactive={s.inactive} />
              ))}
              {viewMode === "summary" && (dbCat.length - visibleDb.length) > 0 && (
                <p className="px-5 py-2 text-[10px] text-gray-400 border-t border-gray-50">
                  {dbCat.length - visibleDb.length} additional field{dbCat.length - visibleDb.length > 1 ? "s" : ""} hidden in Summary view
                </p>
              )}
            </>
          ) : visibleSeeded.length > 0 ? (
            // Schema template — before documents arrive
            <>
              {visibleSeeded.map(s => (
                <SeededFieldRow key={s.key} field={s} isCoordinator={isCoordinator}
                  propertyId={propertyId} ownerToken={ownerToken}
                  onUpdated={onUpdated} onRequestUpload={onRequestUpload}
                  dependencyInactive={s.inactive} />
              ))}
              <p className="px-5 py-2.5 text-[10px] text-gray-400 italic border-t border-gray-50">
                Upload documents — Kontra will extract these fields automatically.
              </p>
            </>
          ) : (
            <p className="px-5 py-4 text-xs text-gray-400 italic">No information collected yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AssetRecordTab({
  propertyId, packId: rawPackId, pack, isCoordinator,
  isTokenizationRelevant, daReadinessEnabled,
  onEnableDAReadiness, onOpenDAReadiness,
  workspaceMeta, onNavigateToDocuments,
}) {
  const [dbFields,   setDbFields]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [ownerToken, setOwnerToken] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [enablingDA, setEnablingDA] = useState(false);

  // Summary is the operational default; Full Record remains available for the
  // complete pack schema, including expected-but-empty items.
  const [viewMode, setViewMode] = useState("summary");

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
        const fields = data.fields || [];
        setDbFields(fields);
      }
    } finally { setLoading(false); }
  }, [propertyId, ownerToken]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    const interval = setInterval(() => load(), 10000);
    return () => clearInterval(interval);
  }, [load]);

  async function triggerExtract() {
    if (!ownerToken) return;
    setExtracting(true);
    try {
      await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/transaction-record/extract`, {
        method: "POST", headers: { "Content-Type": "application/json" },
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

  // Resolve the schema key using three-layer fallback:
  //   1. rawPackId (built-in pack like "cre_acquisition")
  //   2. pack.transactionType (custom ws_* packs store their base type here)
  //   3. workspace name inference ("hotel", "apartment", "series a", etc.)
  const schemaKey    = resolveSchemaKey(rawPackId || pack?.id, pack, workspaceMeta?.name);
  const seededFields = buildSeededFromSchema(schemaKey, workspaceMeta);
  const summaryKeys = getSummaryFieldKeys(schemaKey);
  const summarySchemaFields = seededFields.filter(field =>
    isSummarySchemaField(field, summaryKeys)
  );

  // Header stats
  const isInactiveRecord = (seeded, db) =>
    dependencyIsInactive(seeded, dbFields, seededFields);
  const fullStats = getRecordStats(
    seededFields,
    dbFields,
    seededFields,
    () => true,
    isInactiveRecord,
  );
  const summaryStats = getRecordStats(
    summarySchemaFields,
    dbFields,
    seededFields,
    field => summaryKeys.has(canonicalRecordKey(field, seededFields)) || isSummaryException(field),
    isInactiveRecord,
    false,
  );
  const activeStats = viewMode === "summary" ? summaryStats : fullStats;
  const pct = activeStats.total > 0
    ? Math.round((activeStats.complete / activeStats.total) * 100)
    : 0;

  const LEGAL_TOOLTIP = "Kontra organizes transaction information and participant confirmations; it does not provide legal certification or independent verification. \"Workflow required\" means this item is configured as necessary to complete this workspace workflow. It does not mean the item is legally, regulatorily, or contractually required.";

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
      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-sm font-bold text-gray-900">Transaction Record</p>
              <InfoTooltip text={LEGAL_TOOLTIP} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Structured information extracted from transaction documents and confirmed by participants.
              Source references and confirmation history are preserved for each field.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Summary / Full toggle */}
            <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden text-[10px] font-semibold">
              <button
                onClick={() => setViewMode("summary")}
                className={`px-2.5 py-1.5 transition ${viewMode === "summary" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
                style={viewMode === "summary" ? { background: ACCENT } : {}}>
                Summary
              </button>
              <button
                onClick={() => setViewMode("full")}
                className={`px-2.5 py-1.5 transition ${viewMode === "full" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
                style={viewMode === "full" ? { background: ACCENT } : {}}>
                Full Record
              </button>
            </div>
            {isCoordinator && dbFields.length > 0 && (
              <button onClick={triggerExtract} disabled={extracting}
                className="text-[10px] font-semibold px-2.5 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
                {extracting ? "…" : "Re-extract"}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: pct === 100 ? "#22c55e" : ACCENT }} />
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-700 shrink-0">
            {activeStats.complete} of {activeStats.total} {viewMode === "summary" ? "key items" : "fields"} complete · {pct}%
          </p>
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          <span className="text-[10px] text-gray-400">
            {activeStats.extracted} extracted · {activeStats.confirmed} confirmed · {activeStats.manuallyEntered} manually entered · {activeStats.awaiting} awaiting information
            {activeStats.fromSetup > 0 ? ` · ${activeStats.fromSetup} from setup` : ""}
            {activeStats.notApplicable > 0 ? ` · ${activeStats.notApplicable} N/A` : ""}
          </span>
          {viewMode === "summary" && (
            <span className="text-[10px] text-gray-400">{fullStats.fieldCount} fields in full record</span>
          )}
        </div>
      </div>

      {/* ── Category sections ── */}
      {CATEGORIES.map(cat => (
        <CategorySection
          key={cat.key}
          category={cat}
          dbFields={dbFields}
          seededFields={seededFields}
          isCoordinator={isCoordinator}
          propertyId={propertyId}
          ownerToken={ownerToken}
          onUpdated={() => setRefreshKey(k => k + 1)}
          viewMode={viewMode}
          summaryKeys={summaryKeys}
          onRequestUpload={onNavigateToDocuments}
        />
      ))}

      {/* ── Digital Asset Readiness ── */}
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
                <p className="text-[10px] text-gray-400 mt-1 italic">AI suggestion only. You decide whether this applies.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleEnableDA} disabled={enablingDA}
                className="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: ACCENT }}>
                {enablingDA ? "Enabling…" : "Add preparation workflow"}
              </button>
              <button className="text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
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
                <p className="text-xs text-gray-400 mt-0.5">Preparation workflow enabled · Organize for external provider review</p>
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
