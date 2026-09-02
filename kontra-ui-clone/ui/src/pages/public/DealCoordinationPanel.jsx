import { useState, useEffect, useCallback, useRef } from 'react';
import { getWorkflowPack, DEFAULT_PACK_ID } from '../../lib/workflowPacks';
import { getRoomAuthHeaders } from '../../lib/inviteUtils';

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

// Default icon/desc for known stage keys (cosmetic only)
const STAGE_META_DEFAULTS = {
  uploading:    { icon: '📤', desc: 'Parties submitting documents' },
  under_review: { icon: '🔍', desc: 'Reviewing submissions' },
  approved:     { icon: '✅', desc: 'Deal approved' },
  closing:      { icon: '✍️', desc: 'Signing & funding in process' },
  funded:       { icon: '🏦', desc: 'Deal closed' },
};
const DEFAULT_STAGE_ICON = '📌';

function enrichStage(s) {
  const meta = STAGE_META_DEFAULTS[s.key] || {};
  return {
    icon: s.icon || meta.icon || DEFAULT_STAGE_ICON,
    desc: s.desc || meta.desc || s.label,
    ...s,
  };
}

// Suggested icons for stage picker in ManageStagesPanel
const STAGE_ICONS = ['📤','🔍','✅','✍️','🏦','📌','📋','🤝','💬','📝','🔒','⏳','🚀','🎯','💰','🔑'];

// ── Manage Stages Panel ───────────────────────────────────────────────────────
function ManageStagesPanel({ stages, currentStageKey, propertyId, onSave, onCancel }) {
  const [items, setItems] = useState(() => stages.map((s, i) => ({ ...enrichStage(s), _id: String(i) })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [showIconPickerFor, setShowIconPickerFor] = useState(null);
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);

  function handleRename(idx, label) {
    setItems(prev => prev.map((s, i) => i === idx ? { ...s, label } : s));
  }

  function handleIconChange(idx, icon) {
    setItems(prev => prev.map((s, i) => i === idx ? { ...s, icon } : s));
    setShowIconPickerFor(null);
  }

  function handleDelete(idx) {
    if (items.length <= 2) {
      setError('A deal room needs at least 2 stages.');
      return;
    }
    const toDelete = items[idx];
    if (toDelete.key === currentStageKey) {
      setError(`"${toDelete.label}" is the active stage — advance the deal room first.`);
      return;
    }
    setError('');
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function handleAdd() {
    const ts = Date.now();
    setItems(prev => [...prev, {
      key: `stage_${ts}`,
      label: 'New Stage',
      icon: DEFAULT_STAGE_ICON,
      desc: '',
      _id: String(ts),
    }]);
    // Auto-focus the new item's label field after render
    setTimeout(() => setEditingIdx(items.length), 0);
  }

  // ── HTML5 drag-and-drop ───────────────────────────────────────────────────
  function handleDragStart(e, idx) {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
  }

  function handleDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    dragIdx.current = null;
    dragOverIdx.current = null;
  }

  function handleDragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx.current === null || dragIdx.current === idx) return;
    if (dragOverIdx.current === idx) return;
    dragOverIdx.current = idx;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx.current, 1);
      next.splice(idx, 0, moved);
      dragIdx.current = idx;
      return next;
    });
  }

  function handleDrop(e) {
    e.preventDefault();
  }

  async function handleSave() {
    const trimmed = items.map(s => ({ ...s, label: s.label.trim() }));
    const bad = trimmed.find(s => !s.label);
    if (bad) { setError('All stage names must be non-empty.'); return; }
    if (trimmed.length < 2) { setError('At least 2 stages are required.'); return; }
    setError('');
    setSaving(true);
    let ownerToken = '';
    try { ownerToken = localStorage.getItem(`kontra_owner_token_${propertyId}`) || ''; } catch {}
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/stages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: trimmed, ownerWriteToken: ownerToken }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Save failed (${res.status})`);
      }
      const { stages: saved } = await res.json();
      onSave(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-800">Manage Stages</p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 transition border border-gray-200 bg-white">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Stages'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[10px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 mb-3">{error}</p>
      )}

      <div className="space-y-1.5 mb-3">
        {items.map((stage, idx) => {
          const isActive = stage.key === currentStageKey;
          return (
            <div
              key={stage._id}
              draggable
              onDragStart={e => handleDragStart(e, idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={handleDrop}
              className={`flex items-center gap-2 bg-white rounded-xl border px-3 py-2 group transition cursor-grab active:cursor-grabbing
                ${isActive ? 'border-[#800020]/30 bg-[#800020]/5' : 'border-gray-200 hover:border-gray-300'}`}
            >
              {/* Drag handle */}
              <span className="text-gray-300 group-hover:text-gray-500 transition text-sm select-none shrink-0 cursor-grab">⠿</span>

              {/* Icon picker */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowIconPickerFor(showIconPickerFor === idx ? null : idx)}
                  className="text-base hover:scale-110 transition w-6 h-6 flex items-center justify-center rounded focus:outline-none"
                  title="Change icon"
                >
                  {stage.icon}
                </button>
                {showIconPickerFor === idx && (
                  <div className="absolute left-0 top-8 z-10 bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-40 grid grid-cols-8 gap-1">
                    {STAGE_ICONS.map(ic => (
                      <button key={ic} onClick={() => handleIconChange(idx, ic)}
                        className={`text-base hover:scale-110 transition rounded ${stage.icon === ic ? 'bg-[#800020]/10' : ''}`}>
                        {ic}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                {editingIdx === idx ? (
                  <input
                    autoFocus
                    value={stage.label}
                    onChange={e => handleRename(idx, e.target.value)}
                    onBlur={() => setEditingIdx(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingIdx(null); }}
                    className="w-full text-xs font-medium text-gray-800 bg-transparent border-b border-[#800020]/40 focus:outline-none py-0.5"
                  />
                ) : (
                  <button
                    onClick={() => setEditingIdx(idx)}
                    className="text-xs font-medium text-gray-800 hover:text-[#800020] transition text-left w-full truncate"
                    title="Click to rename"
                  >
                    {stage.label}
                    {isActive && <span className="ml-1.5 text-[9px] font-bold text-[#800020] bg-[#800020]/10 px-1 rounded">active</span>}
                  </button>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(idx)}
                disabled={items.length <= 2 || isActive}
                className="text-gray-300 hover:text-red-500 transition text-sm shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                title={isActive ? 'Active stage — cannot delete' : items.length <= 2 ? 'Need at least 2 stages' : 'Delete stage'}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleAdd}
        className="w-full py-2 rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-300 transition"
      >
        + Add Stage
      </button>

      <p className="text-[9px] text-gray-400 mt-2">Drag to reorder · Click label to rename · Click icon to change</p>
    </div>
  );
}

// ── Main DealCoordinationPanel ────────────────────────────────────────────────
export default function DealCoordinationPanel({ propertyId, role, packId = DEFAULT_PACK_ID, propertyType }) {
  const workflowPack = getWorkflowPack(packId);
  const PACK_STAGES = workflowPack.stages;
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
  // Custom stages state
  const [customStages, setCustomStages] = useState(null); // null = use pack default
  const [showManage, setShowManage] = useState(false);

  const fetchCoordination = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/coordination?t=${Date.now()}`, {
        headers: getRoomAuthHeaders(propertyId, { 'Cache-Control': 'no-cache' }),
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

  const fetchStages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/stages`, {
        headers: getRoomAuthHeaders(propertyId),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.stages) && json.stages.length >= 2) {
        setCustomStages(json.stages.map(enrichStage));
      }
    } catch {
      // silent — fall back to pack stages
    }
  }, [propertyId]);

  useEffect(() => {
    fetchCoordination();
    fetchStages();
    const interval = setInterval(fetchCoordination, 20000);
    return () => clearInterval(interval);
  }, [fetchCoordination, fetchStages]);

  // Effective stages: custom (if saved) or pack default
  const effectiveStages = customStages || PACK_STAGES;

  // Build nextStage and advanceLabel dynamically from the ordered stage list
  const effectiveNextStage = Object.fromEntries(
    effectiveStages.slice(0, -1).map((s, i) => [s.key, effectiveStages[i + 1].key])
  );
  const effectiveAdvanceLabel = Object.fromEntries(
    effectiveStages.slice(0, -1).map((s, i) => [s.key, `Move to ${effectiveStages[i + 1].label}`])
  );

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/submit`, {
        method: 'POST',
        headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
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
    const nextStage = effectiveNextStage[data?.stage];
    if (!nextStage) return;
    setAdvancing(true);
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/advance`, {
        method: 'POST',
        headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
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
        headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
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
  const stageIdx = effectiveStages.findIndex(s => s.key === stage);
  const submissions = data.submissions || [];
  const docsByRole = data.docsByRole || {};
  // The last stage in the effective list acts as "funded" (deal complete)
  const isLastStage = stageIdx === effectiveStages.length - 1 && stageIdx >= 0;
  const canManage = !!ROLE_META[role]?.canManage;
  const canAdvance = canManage && !isLastStage;
  const canSetStatus = canManage;
  const submittedRoles = new Set(submissions.map(s => s.role));
  const requiredRoles = Object.entries(ROLE_META).filter(([, m]) => m.required).map(([k]) => k);
  const allRequiredIn = requiredRoles.every(r => submittedRoles.has(r));
  const currentUserSubmission = submissions.find(s => s.role === role);
  const myDocCount = docsByRole[role] || 0;
  const myMeta = ROLE_META[role];

  // Context-aware Signal Ready subtext: does this role have assigned documents?
  const documentSchema = workflowPack.getDocumentSchema?.(propertyType) || [];
  const myAssignedDocs = documentSchema.filter(d => (d.assignedTo || []).includes(role));

  // Per-party upload progress — "X/Y docs" in each party card
  const assignedCountByRole = {};
  for (const doc of documentSchema) {
    for (const r of (doc.assignedTo || [])) {
      assignedCountByRole[r] = (assignedCountByRole[r] || 0) + 1;
    }
  }

  const currentStageData = stageIdx >= 0 ? effectiveStages[stageIdx] : effectiveStages[0];

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Stage tracker header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
              {packId === 'cre_acquisition' ? 'Deal Progress' : 'Transaction Progress'}
            </p>
            <h3 className="text-base font-bold text-gray-900">
              {currentStageData?.icon} {currentStageData?.label}
              <span className="ml-2 text-sm font-normal text-gray-400">— {currentStageData?.desc}</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Manage stages gear — visible to coordinators only */}
            {canManage && (
              <button
                onClick={() => setShowManage(prev => !prev)}
                title="Manage stages"
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition
                  ${showManage ? 'bg-[#800020]/10 text-[#800020]' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'}`}
              >
                ⚙
              </button>
            )}
            {canAdvance && !isLastStage && (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={handleAdvance}
                  disabled={advancing}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#800020] transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {advancing ? 'Updating…' : (effectiveAdvanceLabel[stage] || 'Advance') + ' →'}
                </button>
                {stage === effectiveStages[0]?.key && !allRequiredIn && (
                  <p className="text-[9px] text-amber-500 font-medium text-right">
                    ⚠ {requiredRoles.filter(r => !submittedRoles.has(r)).length} required{' '}
                    {requiredRoles.filter(r => !submittedRoles.has(r)).length === 1 ? 'party' : 'parties'} pending
                  </p>
                )}
              </div>
            )}
            {isLastStage && (
              <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-green-700 bg-green-100">
                🏦 {currentStageData?.label}
              </span>
            )}
          </div>
        </div>

        {/* Step bar — effective stages + synthetic "Verified ✓" final step */}
        <div className="flex items-center gap-0">
          {effectiveStages.map((s, i) => {
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
                {/* connector between stages — not after the last one */}
                {i < effectiveStages.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 mb-3 rounded ${i < stageIdx ? 'bg-[#800020]' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Manage Stages panel (inline, coordinator only) */}
      {showManage && canManage && (
        <ManageStagesPanel
          stages={effectiveStages}
          currentStageKey={stage}
          propertyId={propertyId}
          onSave={saved => {
            const enriched = saved.map(enrichStage);
            setCustomStages(enriched);
            setShowManage(false);
          }}
          onCancel={() => setShowManage(false)}
        />
      )}

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
                      {(() => {
                        const total = assignedCountByRole[roleKey] || 0;
                        if (docs > 0 || total > 0) {
                          const pct = total > 0 ? Math.round((docs / total) * 100) : 100;
                          return (
                            <div>
                              <span className="text-[9px] text-gray-400">{docs}{total > 0 ? `/${total}` : ''} doc{total !== 1 ? 's' : ''}</span>
                              {total > 0 && (
                                <div className="mt-0.5 h-1 w-full rounded-full bg-gray-200 overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: docs >= total ? '#16a34a' : '#d97706' }} />
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
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
                  ) : (() => {
                    const total = assignedCountByRole[roleKey] || 0;
                    if (total > 0) {
                      const pct = total > 0 ? Math.round((docs / total) * 100) : 0;
                      return (
                        <div>
                          <span className={`text-[9px] font-semibold ${meta.required ? 'text-amber-500' : 'text-gray-400'}`}>
                            {docs}/{total} docs · pending
                          </span>
                          <div className="mt-0.5 h-1 w-full rounded-full bg-gray-200 overflow-hidden">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    }
                    return (
                      <span className={`text-[9px] font-semibold ${meta.required ? 'text-amber-500' : 'text-gray-400'}`}>
                        Awaiting
                      </span>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit CTA */}
      {!submitted && !isLastStage && (
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
                  {myAssignedDocs.length > 0
                    ? myDocCount > 0
                      ? `${myDocCount} document${myDocCount !== 1 ? 's' : ''} uploaded — signal the team you're ready for review`
                      : 'Upload your documents above, then signal the team when done'
                    : 'Signal the team when you\'ve reviewed the deal documents'}
                </p>
              </div>
              <button
                onClick={() => setShowNamePrompt(true)}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#800020] hover:opacity-90 transition"
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
