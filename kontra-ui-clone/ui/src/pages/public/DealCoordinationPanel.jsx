import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const STAGES = [
  { key: 'uploading',    label: 'Uploading',    icon: '📤', desc: 'Parties submitting documents' },
  { key: 'under_review', label: 'Under Review', icon: '🔍', desc: 'Lender reviewing submissions' },
  { key: 'approved',     label: 'Approved',     icon: '✅', desc: 'Deal approved — finalizing' },
  { key: 'closing',      label: 'Closing',      icon: '✍️', desc: 'Signing & funding in process' },
  { key: 'funded',       label: 'Funded',       icon: '🏦', desc: 'Deal closed and funded' },
];

const ROLE_META = {
  owner:     { label: 'Owner / Borrower',    icon: '🏢', required: true,  needsDocs: false },
  lender:    { label: 'Lender / Underwriter',icon: '🏦', required: true,  needsDocs: true  },
  inspector: { label: 'Inspector',           icon: '🔍', required: true,  needsDocs: true  },
  insurer:   { label: 'Insurance Broker',    icon: '🛡️', required: true,  needsDocs: true  },
  attorney:   { label: 'Attorney',            icon: '⚖️', required: false, needsDocs: false },
  investor:   { label: 'Investor',            icon: '📊', required: false, needsDocs: false },
  servicer:   { label: 'Servicer',            icon: '⚙️', required: false, needsDocs: false },
  franchisor: { label: 'Franchisor / Brand',  icon: '🏨', required: false, needsDocs: false },
};

const NEXT_STAGE = {
  uploading:    'under_review',
  under_review: 'approved',
  approved:     'closing',
  closing:      'funded',
};

const ADVANCE_LABEL = {
  uploading:    'Move to Under Review',
  under_review: 'Mark as Approved',
  approved:     'Begin Closing',
  closing:      'Mark as Funded',
};

export default function DealCoordinationPanel({ propertyId, role }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [submitterName, setSubmitterName] = useState('');
  const [submitterNotes, setSubmitterNotes] = useState('');

  const fetchCoordination = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/coordination?t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) {
        console.warn('[coordination] fetch failed:', res.status);
        return;
      }
      const json = await res.json();
      setData(json);
      const alreadySubmitted = (json.submissions || []).some(s => s.role === role);
      setSubmitted(alreadySubmitted);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [propertyId, role]);

  useEffect(() => {
    fetchCoordination();
    const interval = setInterval(fetchCoordination, 20000);
    return () => clearInterval(interval);
  }, [fetchCoordination]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, name: submitterName || role, notes: submitterNotes }),
      });
      if (res.ok) {
        setSubmitted(true);
        setShowNamePrompt(false);
        await fetchCoordination();
      }
    } catch { /* silent */ } finally {
      setSubmitting(false);
    }
  }

  async function handleAdvance() {
    const nextStage = NEXT_STAGE[data?.stage];
    if (!nextStage) return;
    setAdvancing(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage }),
      });
      if (res.ok) await fetchCoordination();
    } catch { /* silent */ } finally {
      setAdvancing(false);
    }
  }

  if (loading) return null;
  if (!data) return null;

  const stage = data.stage || 'uploading';
  const stageIdx = STAGES.findIndex(s => s.key === stage);
  const submissions = data.submissions || [];
  const docsByRole = data.docsByRole || {};
  const isFunded = stage === 'funded';
  const canAdvance = (role === 'owner' || role === 'lender') && !isFunded;
  const submittedRoles = new Set(submissions.map(s => s.role));
  const requiredRoles = Object.entries(ROLE_META).filter(([, m]) => m.required).map(([k]) => k);
  const allRequiredIn = requiredRoles.every(r => submittedRoles.has(r));
  const currentUserSubmission = submissions.find(s => s.role === role);
  const myDocCount = docsByRole[role] || 0;
  const myMeta = ROLE_META[role];

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Stage tracker header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Deal Progress</p>
            <h3 className="text-base font-bold text-gray-900">
              {STAGES[stageIdx]?.icon} {STAGES[stageIdx]?.label}
              <span className="ml-2 text-sm font-normal text-gray-400">— {STAGES[stageIdx]?.desc}</span>
            </h3>
          </div>
          {canAdvance && !isFunded && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleAdvance}
                disabled={advancing}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#800020] transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {advancing ? 'Updating…' : ADVANCE_LABEL[stage] + ' →'}
              </button>
              {stage === 'uploading' && !allRequiredIn && (
                <p className="text-[9px] text-amber-500 font-medium text-right">
                  ⚠ {requiredRoles.filter(r => !submittedRoles.has(r)).length} required {requiredRoles.filter(r => !submittedRoles.has(r)).length === 1 ? 'party' : 'parties'} pending
                </p>
              )}
            </div>
          )}
          {isFunded && (
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-green-700 bg-green-100">🏦 Deal Funded</span>
          )}
        </div>

        {/* Step bar */}
        <div className="flex items-center gap-0">
          {STAGES.map((s, i) => {
            const done = i < stageIdx;
            const active = i === stageIdx;
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-all
                    ${done ? 'bg-[#800020] text-white' : active ? 'bg-[#800020]/10 border-2 border-[#800020] text-[#800020]' : 'bg-gray-100 text-gray-400'}`}>
                    {done ? '✓' : s.icon}
                  </div>
                  <p className={`text-[9px] font-semibold text-center leading-tight
                    ${active ? 'text-[#800020]' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                    {s.label}
                  </p>
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 mb-3 rounded ${i < stageIdx ? 'bg-[#800020]' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Party status grid */}
      <div className="px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Party Status</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(ROLE_META).map(([roleKey, meta]) => {
            const sub = submissions.find(s => s.role === roleKey);
            const docs = docsByRole[roleKey] || 0;
            const isMe = roleKey === role;
            const isSubmitted = !!sub;

            return (
              <div key={roleKey}
                className={`relative rounded-xl px-3 py-2.5 border transition-all
                  ${isMe ? 'border-[#800020]/30 bg-[#800020]/5' : 'border-gray-100 bg-gray-50'}
                  ${isSubmitted ? 'opacity-100' : 'opacity-70'}`}
              >
                {isMe && (
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-[#800020] bg-[#800020]/10 px-1 rounded">you</span>
                )}
                <div className="text-base mb-1">{meta.icon}</div>
                <p className="text-[10px] font-semibold text-gray-700 leading-tight">{meta.label}</p>
                {meta.required && <p className="text-[8px] text-gray-400 mb-1">Required</p>}
                <div className="mt-1.5 flex items-center gap-1">
                  {isSubmitted ? (
                    <>
                      <span className="text-[9px] font-bold text-green-600">✓ Submitted</span>
                      {docs > 0 && <span className="text-[9px] text-gray-400">· {docs} doc{docs !== 1 ? 's' : ''}</span>}
                    </>
                  ) : (
                    <span className={`text-[9px] font-semibold ${meta.required ? 'text-amber-500' : 'text-gray-400'}`}>
                      {docs > 0 ? `${docs} doc${docs !== 1 ? 's' : ''} · pending` : 'Awaiting'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit CTA — current user's action */}
      {!submitted && stage !== 'funded' && (
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          {showNamePrompt ? (
            <div className="flex flex-col gap-2.5 max-w-sm">
              <p className="text-xs font-semibold text-gray-700">Confirm submission as <span className="capitalize">{ROLE_META[role]?.label || role}</span></p>
              <input
                type="text"
                placeholder="Your name (optional)"
                value={submitterName}
                onChange={e => setSubmitterName(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20"
              />
              <textarea
                placeholder="Notes for the lender (optional)"
                value={submitterNotes}
                onChange={e => setSubmitterNotes(e.target.value)}
                rows={2}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={handleSubmit} disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-50">
                  {submitting ? 'Submitting…' : 'Confirm — I\'m Done ✓'}
                </button>
                <button onClick={() => setShowNamePrompt(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 transition">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">Done uploading your documents?</p>
                <p className="text-xs text-gray-400">
                  {myDocCount > 0
                    ? `${myDocCount} document${myDocCount !== 1 ? 's' : ''} uploaded — signal the team you're ready for review`
                    : myMeta?.needsDocs
                      ? 'Upload your documents above, then signal the team when you\'re done'
                      : 'Signal the team when you\'re ready to proceed'}
                </p>
              </div>
              <button
                onClick={() => setShowNamePrompt(true)}
                disabled={myMeta?.needsDocs && myDocCount === 0}
                title={myMeta?.needsDocs && myDocCount === 0 ? 'Upload your documents above first' : ''}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Signal Ready →
              </button>
            </div>
          )}
        </div>
      )}

      {submitted && (
        <div className="px-6 py-3 border-t border-green-100 bg-green-50 flex items-center gap-2">
          <span className="text-green-600 text-sm">✓</span>
          <p className="text-xs text-green-700 font-semibold">
            Your documents are submitted
            {currentUserSubmission?.notes && <span className="font-normal text-green-600"> — "{currentUserSubmission.notes}"</span>}
          </p>
        </div>
      )}
    </div>
  );
}
