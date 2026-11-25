import React, { useState } from "react";
import { API_BASE } from "../../lib/apiBase";
import { getRoomAuthHeaders } from "../../lib/inviteUtils";

export default function TransactionRecordProvenanceReview({
  propertyId,
  fieldId,
  ownerAccess = false,
  hasDocumentEvidence = false,
  onUpdated,
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  if (!ownerAccess || !hasDocumentEvidence || !fieldId) return null;

  async function detachSource() {
    if (saving || reason.trim().length < 5) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch(
        `${API_BASE}/api/public/deal-room/${encodeURIComponent(propertyId)}/transaction-record/fields/${encodeURIComponent(fieldId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: getRoomAuthHeaders(propertyId, { "Content-Type": "application/json" }),
          body: JSON.stringify({
            provenance_action: "detach",
            provenance_note: reason.trim(),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || data.error || "The source mismatch could not be recorded.");
      }
      setSaved(true);
      setOpen(false);
      setReason("");
      await onUpdated?.();
    } catch (requestError) {
      setError(requestError.message || "The source mismatch could not be recorded.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-1">
      {!open && !saved && (
        <button
          type="button"
          onClick={() => { setOpen(true); setError(""); }}
          className="text-[10px] font-semibold text-amber-800 underline underline-offset-2"
        >
          Flag source mismatch
        </button>
      )}
      {open && (
        <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-2">
          <p className="text-[10px] leading-relaxed text-amber-900">
            The field value will stay unchanged and unconfirmed. The existing source details will remain in its audit history.
          </p>
          <label className="mt-2 block text-[10px] font-semibold text-gray-700" htmlFor={`provenance-note-${fieldId}`}>
            Why does this source not support the value?
          </label>
          <textarea
            id={`provenance-note-${fieldId}`}
            value={reason}
            onChange={event => setReason(event.target.value)}
            maxLength={500}
            rows={2}
            className="mt-1 w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-[11px] text-gray-800"
          />
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={detachSource}
              disabled={saving || reason.trim().length < 5}
              className="rounded-md bg-amber-800 px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Remove source link"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setReason(""); setError(""); }}
              disabled={saving}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-[10px] text-red-700">{error}</p>}
      {saved && (
        <p role="status" className="mt-1 text-[10px] text-emerald-800">
          Source link removed. The value remains unconfirmed.
        </p>
      )}
    </div>
  );
}
