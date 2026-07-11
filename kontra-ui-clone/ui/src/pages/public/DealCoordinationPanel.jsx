import { useState, useEffect, useCallback } from 'react';
import { getWorkflowPack, DEFAULT_PACK_ID } from '../../lib/workflowPacks';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Roles, lifecycle stages, and next-stage/advance-label maps all come from
// the active workflow template — see ui/src/lib/workflowPacks/.

const STATUS_CONFIG = {
  submitted:      { label: 'Submitted',     bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  needs_revision: { label: 'Needs Revision',bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  approved:       { label: 'Approved',      bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500'  },
  rejected:       { label: 'Rejected',      bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500'    },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function DealCoordinationPanel({ propertyId, role, packId = DEFAULT_PACK_ID }) {
  const workflowPack = getWorkflowPack(packId);
  const STAGES = workflowPack.stages;
  const NEXT_STAGE = workflowPack.nextStage;
  const ADVANCE_LABEL = workflowPack.advanceLabel;
  const ROLE_META = Object.fromEntries(workflowPack.roles.map(r => [r.key, r]));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [submitterName, setSubmitterName] = useState('');
  const [submitterNotes, setSubmitterNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [statusNote, setStatusNote] = useState('');
  const [showStatusFor, setShowStatusFor] = useState(null);

  const fetchCoordination = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/coordination?t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
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

  async function handleSetStatus(subRole, status) {
    setUpdatingStatus(subRole);
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/submissions/${subRole}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, status_note: statusNote || null, updater_role: role }),
      });
      if (res.ok) {
        setShowStatusFor(null);
        setStatusNote('');
        await fetchCoordination();
      }
    } catch { /* silent */ } finally {
      setUpdatingStatus(null);
    }
  }

  if (loading) return null;
  if (!data) return null;

  const stage = data.stage || 'uploading';
  const stageIdx = STAGES.findIndex(s => s.key === stage);
  const submissions = data.submissions || [];
  const docsByRole = data.docsByRole || {};
  const isFunded = stage === 'funded';
  const canManage = !!ROLE_META[role]?.canManage;
  const canAdvance = canManage && !isFunded;
  const canSetStatus = canManage;
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
            const subStatus = sub?.status || 'submitted';
            const isShowingStatus = showStatusFor === roleKey;

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
                <div className="mt-1.5 flex flex-col gap-1">
                  {isSubmitted ? (
                    <>
                      <StatusBadge status={subStatus} />
                      {docs > 0 && <span className="text-[9px] text-gray-400">{docs} doc{docs !== 1 ? 's' : ''}</span>}
                      {/* Owner/lender approval controls */}
                      {canSetStatus && !isMe && (
                        <div className="mt-1">
                          {isShowingStatus ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                placeholder="Note (optional)"
                                value={statusNote}
                                onChange={e => setStatusNote(e.target.value)}
                                className="w-full px-1.5 py-1 text-[9px] border border-gray-200 rounded focus:outline-none"
                              />
                              <div className="flex flex-wrap gap-1">
                                {['approved', 'needs_revision', 'rejected'].map(s => (
                                  <button key={s} onClick={() => handleSetStatus(roleKey, s)}
                                    disabled={updatingStatus === roleKey}
                                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition
                                      ${s === 'approved' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                                        s === 'needs_revision' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                                        'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                                    {updatingStatus === roleKey ? '…' :
                                      s === 'approved' ? 'Approve' :
                                      s === 'needs_revision' ? 'Revision' : 'Reject'}
                                  </button>
                                ))}
                                <button onClick={() => { setShowStatusFor(null); setStatusNote(''); }}
                                  className="px-1.5 py-0.5 rounded text-[8px] text-gray-400 hover:text-gray-600">
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setShowStatusFor(roleKey)}
                              className="text-[9px] text-gray-400 hover:text-gray-600 transition underline">
                              Set status
                            </button>
                          )}
                        </div>
                      )}
                      {sub?.status_note && (
                        <p className="text-[8px] text-gray-400 italic">"{sub.status_note}"</p>
                      )}
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

      {/* Submit CTA */}
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
                placeholder="Add a note for the team (optional)"
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
                <p className="text-sm font-semibold text-gray-800">Ready to proceed?</p>
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
