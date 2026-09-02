/**
 * SettlementReadinessPanel.jsx
 *
 * Provider-neutral settlement record panel. Rendered inside OperationsManagerView
 * when the workspace is in the `settlement` stage (or `funded` with settlement
 * capability active, for backward compat).
 *
 * What this panel does:
 *   1. Fetches settlement readiness from GET /settlement/readiness
 *   2. Allows the coordinator to select and lock a settlement mode
 *   3. Shows a scored conditions checklist (field + approval conditions)
 *   4. Provides a "Complete Transaction" CTA that calls POST /settlement/complete
 *   5. Renders a sealed/complete view once the Transaction Seal exists
 *
 * What this panel does NOT do:
 *   - Execute payments, transfers, or blockchain transactions
 *   - Recommend or endorse any specific settlement provider
 *   - Make legal or regulatory determinations
 *   - Store any credential, wallet address, or private key
 */

import React, { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../../lib/apiBase";
import { getRoomAuthHeaders } from "../../lib/inviteUtils";

// ── Settlement mode metadata ─────────────────────────────────────────────────

const MODES = [
  {
    id: "traditional",
    label: "Traditional",
    icon: "🏦",
    desc: "Standard banking rails — wire transfer, ACH, escrow, or similar established settlement channels.",
    chip: "Wire / Escrow / ACH",
  },
  {
    id: "digital",
    label: "Digital",
    icon: "💱",
    desc: "Provider-neutral digital settlement interface. Kontra records settlement references only — no chain connectivity in Phase 1.",
    chip: "Rail-agnostic",
  },
  {
    id: "tokenized",
    label: "Tokenized",
    icon: "🪙",
    desc: "A digital-asset settlement proposal may require external provider review, participant checks, and legal analysis. Kontra records preparation information only.",
    chip: "External review",
  },
];

// ── Score ring component ─────────────────────────────────────────────────────

function ScoreRing({ pct, allMet }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = allMet ? "#16a34a" : pct >= 70 ? "#d97706" : "#dc2626";
  return (
    <div className="relative flex items-center justify-center" style={{ width: 104, height: 104 }}>
      <svg width={104} height={104} viewBox="0 0 104 104">
        <circle cx={52} cy={52} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} />
        <circle
          cx={52} cy={52} r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 52 52)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-2xl font-bold" style={{ color }}>{pct}%</span>
        <span className="text-[10px] text-gray-400 mt-0.5">ready</span>
      </div>
    </div>
  );
}

// ── Condition row ────────────────────────────────────────────────────────────

function ConditionRow({ cond }) {
  const { label, type, status, met, role, hint } = cond;
  const [showHint, setShowHint] = useState(false);
  let icon = "○";
  let clr = "text-gray-400";
  if (met) { icon = "✓"; clr = "text-green-600"; }
  else if (status === "needs_review") { icon = "◐"; clr = "text-amber-500"; }
  else if (status === "pending") { icon = "…"; clr = "text-amber-500"; }

  const tagText = type === "approval" ? `Sign-off: ${role || "Required"}` : "Field";
  const tagBg   = type === "approval" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-600";

  return (
    <div className={`flex items-start gap-3 py-2.5 px-3 rounded-xl ${met ? "bg-green-50/50" : "bg-white"} border ${met ? "border-green-100" : "border-gray-100"}`}>
      <span className={`text-base font-bold mt-0.5 flex-shrink-0 ${clr}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tagBg}`}>{tagText}</span>
          {hint && (
            <button
              onClick={() => setShowHint(v => !v)}
              className="text-[10px] text-gray-400 hover:text-gray-600"
              title="Show hint"
            >?</button>
          )}
        </div>
        {showHint && hint && (
          <p className="text-xs text-gray-500 mt-1">{hint}</p>
        )}
        {!met && (
          <p className="text-xs text-gray-400 mt-0.5">
            {type === "approval" ? "Awaiting approval sign-off" :
             status === "needs_review" ? "Uploaded but needs verification" :
             "Missing — add via Transaction Record"}
          </p>
        )}
      </div>
      <span className="text-xs text-gray-300 flex-shrink-0 mt-1">
        {met ? "Verified" : status === "needs_review" ? "Review" : type === "approval" ? "Pending" : "Missing"}
      </span>
    </div>
  );
}

// ── Sealed / Complete view ───────────────────────────────────────────────────

function SealedView({ sealData, propertyId }) {
  const [seal, setSeal] = useState(sealData);
  const [loading, setLoading] = useState(!sealData);

  // Post-completion records state
  const [pcDocs,     setPcDocs]     = useState([]);
  const [pcLoading,  setPcLoading]  = useState(true);
  const [uploading,  setUploading]  = useState(false);
  const [uploadMsg,  setUploadMsg]  = useState(null); // { type: 'ok'|'err', text }

  useEffect(() => {
    if (sealData) return;
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/settlement/seal`, {
      headers: getRoomAuthHeaders(propertyId),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSeal(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [propertyId, sealData]);

  // Fetch post-completion records from the analyses endpoint
  const fetchPcDocs = useCallback(() => {
    setPcLoading(true);
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses`, {
      headers: getRoomAuthHeaders(propertyId),
    })
      .then(r => r.ok ? r.json() : { post_completion_records: [] })
      .then(d => setPcDocs(Array.isArray(d.post_completion_records) ? d.post_completion_records : []))
      .catch(() => setPcDocs([]))
      .finally(() => setPcLoading(false));
  }, [propertyId]);

  useEffect(() => { fetchPcDocs(); }, [fetchPcDocs]);

  // Upload a post-completion document via track-document endpoint.
  // The API stamps post_completion=true automatically when the room is sealed.
  async function handlePcUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true); setUploadMsg(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('section', 'post_completion');
      form.append('label', file.name);
      const resp = await fetch(
        `${API_BASE}/api/public/deal-room/${propertyId}/track-document`,
        { method: 'POST', headers: getRoomAuthHeaders(propertyId), body: form }
      );
      const json = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json.error || 'Upload failed');
      setUploadMsg({ type: 'ok', text: `${file.name} added to Post-Completion Records.` });
      await fetchPcDocs();
    } catch (err) {
      setUploadMsg({ type: 'err', text: err.message });
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
        Loading Transaction Seal…
      </div>
    );
  }

  const sealedAt = seal?.sealed_at ? new Date(seal.sealed_at).toLocaleString() : "—";
  const mode = seal?.settlement_mode || seal?.summary?.settlement_mode || "—";
  const conditionsVerified = seal?.summary?.verified_count ?? "—";
  const conditionsTotal = seal?.summary?.conditions_count ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xl">✅</span>
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">Transaction Sealed</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            This deal room reached the recorded settlement stage on {sealedAt}. The Transaction Seal is a permanent digital record of the conditions recorded in Kontra — it is not a legal instrument.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Settlement Mode",        value: mode.charAt(0).toUpperCase() + mode.slice(1) },
          { label: "Conditions Verified",    value: `${conditionsVerified} / ${conditionsTotal}` },
          { label: "Sealed At",              value: sealedAt },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      {seal?.summary?.conditions_verified?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Verified at sealing</p>
          <div className="space-y-1">
            {seal.summary.conditions_verified.map(c => (
              <div key={c.key} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="text-green-500">✓</span>
                <span>{c.label}</span>
                <span className="text-xs text-gray-400 ml-1">{c.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Post-Completion Records ───────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-700">Post-Completion Records</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Documents added after sealing — not part of the original Transaction Seal.
            </p>
          </div>
          <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white cursor-pointer transition hover:opacity-90 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            style={{ background: '#800020' }}>
            <input type="file" className="hidden" onChange={handlePcUpload} disabled={uploading} />
            {uploading ? 'Uploading…' : '+ Add Document'}
          </label>
        </div>

        {uploadMsg && (
          <div className={`px-4 py-2 text-xs ${uploadMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {uploadMsg.text}
          </div>
        )}

        {pcLoading ? (
          <div className="px-4 py-4 text-xs text-gray-400 text-center">Loading records…</div>
        ) : pcDocs.length === 0 ? (
          <div className="px-4 py-5 text-center">
            <p className="text-xs text-gray-400">No post-completion documents yet.</p>
            <p className="text-[10px] text-gray-300 mt-0.5">
              Upload supporting documents such as wire confirmations or signed statements.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pcDocs.map(doc => (
              <div key={doc.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-base leading-none">📄</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 truncate">
                    {doc.filename || doc.section}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Added {doc.post_completion_added_at
                      ? new Date(doc.post_completion_added_at).toLocaleString()
                      : new Date(doc.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 font-medium">
                  post-completion
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => {
          const url = `${API_BASE}/api/public/deal-room/${propertyId}/settlement/seal`;
          window.open(url, "_blank");
        }}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded-xl border border-gray-200 hover:border-gray-300 transition-all"
      >
        <span>📄</span>
        View Seal Record
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function SettlementReadinessPanel({
  propertyId,
  property,
  ownerWriteToken,
  isCoordinator = true,
}) {
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedMode, setSelectedMode] = useState(null);
  const [modeLoading, setModeLoading] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeError, setCompleteError] = useState(null);

  const fetchReadiness = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/settlement/readiness`, {
      headers: getRoomAuthHeaders(propertyId),
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => {
        setReadiness(data);
        setSelectedMode(data.mode || null);
        setError(null);
      })
      .catch(() => setError("Could not load settlement readiness. Please try again."))
      .finally(() => setLoading(false));
  }, [propertyId]);

  useEffect(() => { fetchReadiness(); }, [fetchReadiness]);

  const handleSetMode = async (mode) => {
    if (!isCoordinator) return;
    if (readiness?.mode_locked && mode !== readiness.mode) return;
    setModeLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/settlement/mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getRoomAuthHeaders(propertyId) },
        body: JSON.stringify({ mode, ownerWriteToken }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "Failed to set mode");
      setSelectedMode(mode);
      fetchReadiness();
    } catch (e) {
      alert(`Failed to set settlement mode: ${e.message}`);
    } finally {
      setModeLoading(false);
    }
  };

  const handleLockMode = async () => {
    if (!isCoordinator || !readiness?.mode) return;
    if (!window.confirm(`Lock settlement mode to "${readiness.mode}"? This cannot be changed without contacting support.`)) return;
    setLockLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/settlement/mode/lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getRoomAuthHeaders(propertyId) },
        body: JSON.stringify({ ownerWriteToken }),
      });
      if (!r.ok) throw new Error((await r.json()).message || "Failed to lock mode");
      fetchReadiness();
    } catch (e) {
      alert(`Failed to lock mode: ${e.message}`);
    } finally {
      setLockLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!isCoordinator) return;
    if (!readiness?.all_conditions_met) {
      setCompleteError("All settlement conditions must be verified before completing. Check the conditions checklist above.");
      return;
    }
    if (!window.confirm(
      "Create the Transaction Seal and mark this deal room as complete?\n\n" +
      "The Transaction Seal is a permanent digital record. The transaction record will become immutable. " +
      "New documents can still be uploaded as Post-Completion Records.\n\n" +
      "This action cannot be undone."
    )) return;

    setCompleteLoading(true);
    setCompleteError(null);
    try {
      const r = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/settlement/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRoomAuthHeaders(propertyId) },
        body: JSON.stringify({ ownerWriteToken }),
      });
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data.message || "Failed to complete transaction");
      }
      // Refresh readiness — the room is now sealed
      fetchReadiness();
    } catch (e) {
      setCompleteError(e.message);
    } finally {
      setCompleteLoading(false);
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
          Loading settlement readiness…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 px-6 py-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={fetchReadiness} className="mt-3 text-sm text-red-500 hover:text-red-700 underline">Try again</button>
      </div>
    );
  }

  if (!readiness?.capability_enabled) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 px-6 py-6">
        <h2 className="text-base font-bold text-gray-900 mb-1">Settlement Capability</h2>
        <p className="text-sm text-gray-500">
          Settlement readiness tracking is not active for this deal room.
          Enable it from Deal Room Settings to track recorded settlement conditions.
        </p>
      </div>
    );
  }

  // ── Sealed workspace ───────────────────────────────────────────────────────

  if (readiness.is_complete || readiness.sealed_at) {
    return (
      <div className="bg-white rounded-2xl border border-green-200 px-6 py-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-bold text-gray-900">Settlement — Transaction Sealed</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Complete</span>
        </div>
        <SealedView sealData={null} propertyId={propertyId} />
      </div>
    );
  }

  // ── Active readiness panel ─────────────────────────────────────────────────

  const pct     = readiness.readiness_pct ?? 0;
  const allMet  = readiness.all_conditions_met;
  const mode    = readiness.mode;
  const locked  = readiness.mode_locked;
  const conditions = readiness.conditions || [];
  const unmet   = readiness.unmet || [];

  const fieldConditions    = conditions.filter(c => c.type === "field");
  const approvalConditions = conditions.filter(c => c.type === "approval");

  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Settlement Readiness</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Verify all required conditions before completing the transaction. Score is informational — completion requires all fields verified and all approvals granted.
          </p>
        </div>
        <ScoreRing pct={pct} allMet={allMet} />
      </div>

      {/* Mode selector */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Settlement Mode</p>
          {locked && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">🔒 Locked</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map(m => {
            const isSelected = mode === m.id || selectedMode === m.id;
            const isDisabled = modeLoading || (locked && mode !== m.id) || !isCoordinator;
            return (
              <button
                key={m.id}
                disabled={isDisabled}
                onClick={() => handleSetMode(m.id)}
                className={`rounded-xl border px-3 py-3 text-left transition-all ${
                  isSelected
                    ? "border-gray-800 bg-gray-900 text-white"
                    : isDisabled
                      ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                      : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                <div className="text-lg mb-1">{m.icon}</div>
                <div className={`text-xs font-bold ${isSelected ? "text-white" : "text-gray-900"}`}>{m.label}</div>
                <div className={`text-[10px] mt-0.5 ${isSelected ? "text-gray-300" : "text-gray-400"}`}>{m.chip}</div>
              </button>
            );
          })}
        </div>
        {mode && (
          <p className="text-xs text-gray-500 mt-2">
            {MODES.find(m => m.id === mode)?.desc || ""}
          </p>
        )}
        {isCoordinator && mode && !locked && (
          <button
            onClick={handleLockMode}
            disabled={lockLoading}
            className="mt-2 text-xs text-amber-600 hover:text-amber-800 font-medium"
          >
            {lockLoading ? "Locking…" : "Lock mode →"}
          </button>
        )}
      </div>

      {/* Conditions checklist */}
      {mode ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Required Conditions</p>
            <p className="text-xs text-gray-400">
              {conditions.filter(c => c.met).length} / {conditions.length} verified
            </p>
          </div>

          {fieldConditions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide px-1">Settlement Fields</p>
              {fieldConditions.map(c => <ConditionRow key={c.key} cond={c} />)}
            </div>
          )}

          {approvalConditions.length > 0 && (
            <div className="space-y-1.5 mt-2">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide px-1">Required Approvals</p>
              {approvalConditions.map(c => <ConditionRow key={c.key} cond={c} />)}
            </div>
          )}

          <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 mt-2">
            <p className="text-xs text-blue-700">
              Add and verify settlement fields via the <strong>Transaction Record</strong> tab.
              Approvals are submitted by the authorized parties.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-5 text-center">
          <p className="text-sm text-gray-500">Select a settlement mode above to see the required conditions checklist.</p>
        </div>
      )}

      {/* Completion CTA */}
      {isCoordinator && mode && (
        <div className="border-t border-gray-100 pt-4">
          {allMet ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                <p className="text-sm text-green-800 font-semibold">All conditions verified ✓</p>
                <p className="text-xs text-green-600 mt-0.5">
                  All configured settlement conditions are confirmed. You can now create the Transaction Seal to complete this deal room.
                </p>
              </div>
              {completeError && (
                <p className="text-xs text-red-600 px-1">{completeError}</p>
              )}
              <button
                onClick={handleComplete}
                disabled={completeLoading}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {completeLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating Transaction Seal…
                  </>
                ) : (
                  <>
                    ✅ Complete Transaction — Create Seal
                  </>
                )}
              </button>
              <p className="text-[10px] text-gray-400 text-center px-2">
                Creating the seal makes the transaction record immutable. Documents can still be added as post-completion records.
                This action cannot be undone.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {unmet.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                  <p className="text-xs text-amber-700 font-semibold mb-1.5">
                    {unmet.length} condition{unmet.length !== 1 ? "s" : ""} remaining before completion
                  </p>
                  <ul className="text-xs text-amber-600 space-y-0.5">
                    {unmet.slice(0, 5).map(u => (
                      <li key={u.key} className="flex items-center gap-1.5">
                        <span>○</span> {u.label}
                      </li>
                    ))}
                    {unmet.length > 5 && (
                      <li className="text-amber-400">+{unmet.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              {completeError && (
                <p className="text-xs text-red-600 px-1">{completeError}</p>
              )}
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-100 text-gray-400 text-sm font-bold cursor-not-allowed"
              >
                ✅ Complete Transaction — Conditions Pending
              </button>
            </div>
          )}
        </div>
      )}

      {/* Non-coordinator view */}
      {!isCoordinator && mode && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-400 text-center">
            Settlement completion is managed by the deal-room coordinator.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <strong>Kontra is a coordination platform.</strong> This panel tracks and verifies readiness — it does not execute, settle, or transmit funds, assets, or tokens. The coordinator is responsible for verifying all conditions with the relevant parties. Nothing here constitutes legal, financial, or regulatory advice.
        </p>
      </div>
    </div>
  );
}
