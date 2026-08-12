/**
 * ParticipantsPanel — unified participants table with invite modal.
 *
 * Replaces InvitePanel (v1) and InvitePanelV2.
 * Shows all pack roles with live invite status and a single "Invite Participant"
 * button that opens a compact modal. Per-row ⋮ menu handles resend/revoke/copy.
 *
 * Works for both v1 (supabase RPC) and v2 (REST API + ownerToken) rooms.
 */
import { useState, useEffect, useCallback } from 'react';
import { getWorkflowPack, DEFAULT_PACK_ID } from '../../lib/workflowPacks';
import { createInvite, generatePin, getRoomInvites, revokeInvite } from '../../lib/inviteUtils';
import {
  getCoordinatorRoleKeys,
  getExternalParticipantRoles,
  isCoordinatorRole,
  resolveCoordinatorRole,
} from '../../lib/workflowRoles';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

const STATUS_CFG = {
  not_invited: { label: 'Not invited',      bg: '#f9fafb', color: '#9ca3af', border: '#e5e7eb' },
  pending:     { label: 'Invitation sent',  bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  accepted:    { label: 'Joined',           bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  revoked:     { label: 'Revoked',          bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  expired:     { label: 'Expired',          bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
  superseded:  { label: 'Reissued',         bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
  // Coordinator/owner — part of the workspace by definition, not via invite
  coordinator: { label: 'Owner',            bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function v2Api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.not_invited;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteModal({ open, onClose, prefilledRoleKey, roles, isV2, onSend }) {
  const [email,      setEmail]      = useState('');
  const [name,       setName]       = useState('');
  const [roleKey,    setRoleKey]    = useState('');
  const [message,    setMessage]    = useState('');
  const [customRole, setCustomRole] = useState('');
  const [isCustom,   setIsCustom]   = useState(false);
  const [status,     setStatus]     = useState('idle'); // idle | loading | done
  const [errMsg,     setErrMsg]     = useState('');

  useEffect(() => {
    if (open) {
      setEmail(''); setName(''); setMessage('');
      setCustomRole(''); setIsCustom(false);
      setStatus('idle'); setErrMsg('');
      setRoleKey(prefilledRoleKey || roles[0]?.key || '');
    }
  }, [open, prefilledRoleKey, roles]);

  if (!open) return null;

  const effectiveRoleKey = isCustom
    ? (customRole.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32) || 'guest')
    : roleKey;

  async function handleSend(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { setErrMsg('Enter a valid email address'); return; }
    if (isCustom && !customRole.trim())         { setErrMsg('Enter a role name');           return; }
    setStatus('loading'); setErrMsg('');
    try {
      await onSend({ email: email.trim(), name: name.trim(), roleKey: effectiveRoleKey, message: message.trim() });
      setStatus('done');
    } catch (err) {
      setErrMsg(err.message || 'Failed to send invitation');
      setStatus('idle');
    }
  }

  if (status === 'done') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 p-6 w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center text-xl mx-auto mb-3">✓</div>
          <p className="text-sm font-bold text-gray-900 mb-1">Invitation sent</p>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Kontra emailed the secure invite link to <strong>{email}</strong>.
          </p>
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: '#800020' }}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md">

        {/* Modal header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Invite Participant</h2>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition text-lg leading-none w-6 h-6 flex items-center justify-center">
            ✕
          </button>
        </div>

        <form onSubmit={handleSend} className="px-5 py-4 space-y-4">

          {/* Role */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Role</label>
            <div className="flex flex-wrap gap-1.5">
              {roles.map(r => (
                <button key={r.key} type="button"
                  onClick={() => { setRoleKey(r.key); setIsCustom(false); setErrMsg(''); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition"
                  style={!isCustom && roleKey === r.key
                    ? { background: '#800020', color: '#fff', borderColor: '#800020' }
                    : { background: '#fff', color: '#4b5563', borderColor: '#e5e7eb' }}>
                  <span>{r.icon}</span> {r.label}
                </button>
              ))}
              <button type="button"
                onClick={() => { setIsCustom(true); setErrMsg(''); }}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition"
                title="Custom roles don't map to template-defined responsibilities — use only when no template role fits"
                style={isCustom
                  ? { background: '#800020', color: '#fff', borderColor: '#800020' }
                  : { background: '#fff', color: '#9ca3af', borderColor: '#e5e7eb', borderStyle: 'dashed' }}>
                + Other
              </button>
            </div>
            {isCustom && (
              <input autoFocus type="text" placeholder="e.g. IP Counsel"
                value={customRole} onChange={e => { setCustomRole(e.target.value); setErrMsg(''); }}
                className="mt-2 w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300" />
            )}
          </div>

          {/* Name (optional) */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Name <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <input type="text" placeholder="Jane Smith"
              value={name} onChange={e => setName(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300" />
          </div>

          {/* Email */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Email</label>
            <input type="email" placeholder="participant@firm.com"
              value={email} onChange={e => { setEmail(e.target.value); setErrMsg(''); }}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300" />
          </div>

          {/* Message (optional) */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Message <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <textarea rows={2} placeholder="Add a personal note to your invitation…"
              value={message} onChange={e => setMessage(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300 resize-none" />
          </div>

          {errMsg && <p className="text-[10px] text-red-500">{errMsg}</p>}

          <button type="submit" disabled={status === 'loading'}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ background: '#800020' }}>
            {status === 'loading' ? 'Sending…' : 'Send Invitation'}
          </button>
          <p className="text-[10px] text-gray-400 text-center -mt-1 pb-1">
            Kontra emails a secure invite link.{' '}
            {isV2
              ? 'Participant verifies with a code sent to their email.'
              : 'No sign-in required.'}
          </p>
        </form>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ParticipantsPanel({
  roomId,
  packId = DEFAULT_PACK_ID,
  isV2 = false,
  isCoordinator = false,
  coordinatorRole = null,
}) {
  const pack = getWorkflowPack(packId);

  const metadataCoordinatorRoles = (pack.roles || [])
    .filter(isCoordinatorRole)
    .map(r => ({ key: r.key, icon: r.icon || '🏢', label: r.shortLabel || r.label, color: r.color }));

  // Ownership/session semantics are authoritative. When the room was loaded
  // with access.mode === "owner", render exactly one coordinator row even if a
  // builder-generated pack omitted coordinator metadata entirely.
  const metadataOwnerRole = (pack.roles || []).find(r => r.canManage === true);
  const resolvedCoordinatorRole = resolveCoordinatorRole(pack, { isCoordinator, coordinatorRole });
  const coordinatorRoles = isCoordinator
    ? [resolvedCoordinatorRole || metadataOwnerRole || {
        key: 'deal_coordinator',
        icon: '🏢',
        label: 'Deal Owner',
        color: '#800020',
      }]
    : metadataCoordinatorRoles;

  // The pack's managing role remains authoritative for permissions and
  // transaction vocabulary, but the workspace-owner row has one universal
  // display label. A configured Deal Coordinator remains a separate
  // invitable participant role.
  const displayedCoordinatorRoles = coordinatorRoles.map(role => ({
    ...role,
    label: 'Deal Owner',
    shortLabel: 'Deal Owner',
  }));

  const coordinatorKeys = getCoordinatorRoleKeys(pack, { isCoordinator, coordinatorRole });

  // External participant roles — the only ones that need invitations.
  const invitableRoles = getExternalParticipantRoles(pack, { isCoordinator, coordinatorRole })
    .map(r => ({ key: r.key, icon: r.icon || '👤', label: r.shortLabel || r.label, color: r.color }));

  const [invites,     setInvites]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [ownerToken,  setOwnerToken]  = useState(null);
  const [openMenuId,  setOpenMenuId]  = useState(null);
  const [showModal,   setShowModal]   = useState(false);
  const [modalRole,   setModalRole]   = useState(null);
  const [revoking,    setRevoking]    = useState(null);
  const [resending,   setResending]   = useState(null);
  const [copiedId,    setCopiedId]    = useState(null);

  // Owner token for v2
  useEffect(() => {
    if (!isV2) return;
    import('../../lib/supabaseClient').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setOwnerToken(session?.access_token || null);
      });
    });
  }, [isV2]);

  // Load invites — v1 uses the REST endpoint (owner-write-token auth) so it
  // always returns the current DB state without depending on Supabase JWT auth.
  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      if (isV2) {
        const data = await v2Api('GET', `/api/v2/deal-room/invites/${roomId}`, null, ownerToken);
        setInvites(data.invites || []);
      } else {
        const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
        const { getRoomAuthHeaders } = await import('../../lib/inviteUtils');
        const res  = await fetch(`${API_BASE}/api/public/deal-room/${roomId}/invites`, {
          headers: getRoomAuthHeaders(roomId),
        });
        const data = res.ok ? await res.json() : { invites: [] };
        setInvites(Array.isArray(data.invites) ? data.invites : []);
      }
    } catch {
      setInvites([]);
    }
    setLoading(false);
  }, [roomId, isV2, ownerToken]);

  useEffect(() => { loadInvites(); }, [loadInvites]);

  // ── Send invite ────────────────────────────────────────────────────────────
  async function handleSend({ email, roleKey }) {
    if (isV2) {
      const result = await v2Api('POST', '/api/v2/deal-room/invite/create', {
        roomId, roleKey, invitedEmail: email,
      }, ownerToken);
      if (!result.ok) throw new Error(result.error || 'Failed to send invitation');
    } else {
      // Use link-only auth — participant clicks the link in their email and
      // the token IS the credential. No PIN is generated, stored, or distributed.
      const result = await createInvite({
        propertyId: roomId, roleKey, invitedEmail: email,
        verificationMethod: 'link',
      });
      if (!result.success) throw new Error(result.error || 'Failed to send invitation');
    }
    // Immediately refresh so the People tab reflects the new invite from the DB
    await loadInvites().catch(() => {});
  }

  // ── Revoke ─────────────────────────────────────────────────────────────────
  async function handleRevoke(inviteId) {
    setRevoking(inviteId);
    if (isV2) {
      await v2Api('POST', '/api/v2/deal-room/invite/revoke', { roomId, inviteId }, ownerToken);
    } else {
      await revokeInvite(inviteId);
    }
    await loadInvites();
    setRevoking(null);
    setOpenMenuId(null);
  }

  // ── Reissue (resend) ───────────────────────────────────────────────────────
  async function handleReissue(inviteId) {
    setResending(inviteId);
    if (isV2) {
      await v2Api('POST', '/api/v2/deal-room/invite/reissue', { roomId, inviteId }, ownerToken);
      await loadInvites();
    } else {
      // v1: just open the invite modal to create a new invite for the same role
    }
    setResending(null);
    setOpenMenuId(null);
  }

  // ── Copy secure link ───────────────────────────────────────────────────────
  function handleCopyLink(inv) {
    const token = inv.invite_token || '';
    const url = `${window.location.origin}/deal-room/${roomId}${token ? `?invite=${token}&role=${inv.role_key}` : ''}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
    setOpenMenuId(null);
  }

  // ── Build rows ─────────────────────────────────────────────────────────────
  function buildRows() {
    // Group invites by role
    const byRole = new Map();
    for (const inv of invites) {
      if (!byRole.has(inv.role_key)) byRole.set(inv.role_key, []);
      byRole.get(inv.role_key).push(inv);
    }

    const STATUS_ORDER = { accepted: 0, pending: 1, expired: 2, revoked: 3, superseded: 4 };

    // Coordinator rows at the top — shown with "Owner" badge, no invite flow
    const allKnownRoleKeys = new Set([
      ...invitableRoles.map(r => r.key),
      ...coordinatorRoles.map(r => r.key),
    ]);
    const coordRows = displayedCoordinatorRoles.map(role => ({
      role, invite: null, isCoordinator: true, isCustomRole: false,
    }));

    // Invitable participant rows
    const participantRows = invitableRoles.map(role => {
      const roleInvites = [...(byRole.get(role.key) || [])].sort(
        (a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5),
      );
      return { role, invite: roleInvites[0] || null, isCoordinator: false, isCustomRole: false };
    });

    // Custom-role invites not in the pack
    const seen = new Set();
    const customRows = [];
    for (const inv of invites) {
      if (!allKnownRoleKeys.has(inv.role_key) && !seen.has(inv.role_key)) {
        seen.add(inv.role_key);
        customRows.push({
          role: {
            key:   inv.role_key,
            icon:  '👤',
            label: inv.role_key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            color: '#6b7280',
          },
          invite: inv,
          isCoordinator: false,
          isCustomRole: true,
        });
      }
    }

    return [...coordRows, ...participantRows, ...customRows];
  }

  const rows        = buildRows();
  // Only count external participant invites (not the coordinator/owner row)
  const activeCount = invites.filter(i =>
    ['pending', 'accepted'].includes(i.status) && !coordinatorKeys.has(i.role_key)
  ).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Participants</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeCount} of {invitableRoles.length} participant{invitableRoles.length !== 1 ? 's' : ''} invited
            {pack.name ? <span className="text-gray-300"> · {pack.name} template</span> : null}
          </p>
        </div>
        <button
          onClick={() => { setModalRole(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90 shrink-0"
          style={{ background: '#800020' }}>
          + Invite Participant
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="px-5 py-6 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Column headers (hidden on mobile) */}
          <div className="hidden sm:grid px-5 py-2 border-b border-gray-100 bg-gray-50"
            style={{ gridTemplateColumns: '2fr 2fr 1.5fr 1fr 36px' }}>
            {['Role', 'Participant', 'Status', 'Last activity', ''].map(h => (
              <span key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</span>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {rows.map(({ role, invite, isCoordinator, isCustomRole }) => {
              // ── Coordinator/owner row — always "Owner", no invite flow ────────
              if (isCoordinator) {
                return (
                  <div key={role.key}
                    className="grid px-5 py-2 items-center gap-2 sm:gap-3"
                    style={{ gridTemplateColumns: '1fr' }}>
                    <div className="flex items-center justify-between sm:contents gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base leading-none shrink-0">{role.icon}</span>
                        <span className="text-sm font-semibold text-gray-800 truncate">{role.label}</span>
                      </div>
                      <div className="hidden sm:block min-w-0">
                        <p className="text-xs text-gray-400 italic">Workspace coordinator · Active</p>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status="coordinator" />
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-xs text-gray-400">—</p>
                      </div>
                      <div style={{ width: 36 }} />
                    </div>
                  </div>
                );
              }

              // ── External participant row ───────────────────────────────────────
              const status    = invite?.status || 'not_invited';
              const isActive  = ['pending', 'accepted'].includes(status);
              const isInactive = ['expired', 'superseded'].includes(status);
              const lastSeen  = invite?.last_used_at || null;

              return (
                <div key={role.key}
                  className="grid px-5 py-2 items-center gap-2 sm:gap-3 group/row"
                  style={{ gridTemplateColumns: '1fr' }}>
                  {/* Single-column on mobile */}
                  <div className="flex items-center justify-between sm:contents gap-3">

                    {/* Role */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base leading-none shrink-0">{role.icon}</span>
                      <span className="text-sm font-semibold text-gray-800 truncate">{role.label}</span>
                      {isCustomRole && (
                        <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium leading-tight">custom</span>
                      )}
                    </div>

                    {/* Participant email */}
                    <div className="hidden sm:block min-w-0">
                      {invite?.invited_email ? (
                        <p className="text-xs text-gray-600 truncate">{invite.invited_email}</p>
                      ) : (
                        <p className="text-xs text-gray-300 italic">Not invited yet</p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="shrink-0">
                      <StatusBadge status={status} />
                    </div>

                    {/* Last activity (hidden on mobile) */}
                    <div className="hidden sm:block">
                      <p className="text-xs text-gray-400">
                        {lastSeen ? timeAgo(lastSeen) : (invite?.created_at ? `Sent ${timeAgo(invite.created_at)}` : '—')}
                      </p>
                    </div>

                    {/* Action */}
                    <div className="flex items-center justify-end" style={{ width: 36 }}>
                      {status === 'not_invited' ? (
                        <button
                          onClick={() => { setModalRole(role.key); setShowModal(true); }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition hover:opacity-90"
                          style={{ background: '#800020', color: '#fff' }}>
                          Invite
                        </button>
                      ) : (
                        <div className="relative">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === invite?.id ? null : invite?.id);
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition opacity-0 group-hover/row:opacity-100 focus:opacity-100 text-base leading-none">
                            ⋮
                          </button>

                          {openMenuId === invite?.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                              <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[196px]">

                                {/* Send another / Reissue */}
                                {isActive && (
                                  <button
                                    onClick={() => { setOpenMenuId(null); setModalRole(role.key); setShowModal(true); }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition flex items-center gap-2">
                                    ✉ Send another invitation
                                  </button>
                                )}
                                {isInactive && (
                                  <button
                                    onClick={() => handleReissue(invite.id)}
                                    disabled={resending === invite.id}
                                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition flex items-center gap-2 disabled:opacity-40">
                                    ↩ {resending === invite.id ? 'Reissuing…' : 'Reissue invitation'}
                                  </button>
                                )}
                                {status === 'revoked' && (
                                  <button
                                    onClick={() => { setOpenMenuId(null); setModalRole(role.key); setShowModal(true); }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition flex items-center gap-2">
                                    + Send new invitation
                                  </button>
                                )}

                                {/* Copy link */}
                                {invite && (
                                  <button
                                    onClick={() => handleCopyLink(invite)}
                                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition flex items-center gap-2">
                                    {copiedId === invite.id ? '✓ Copied!' : '🔗 Copy secure link'}
                                  </button>
                                )}

                                {/* Divider + destructive actions */}
                                {isActive && invite && (
                                  <>
                                    <div className="border-t border-gray-100 my-1" />
                                    <button
                                      onClick={() => handleRevoke(invite.id)}
                                      disabled={revoking === invite.id}
                                      className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition flex items-center gap-2 disabled:opacity-40">
                                      ✕ {revoking === invite.id ? 'Revoking…' : 'Revoke access'}
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile-only: participant email below the row */}
                  {invite?.invited_email && (
                    <p className="sm:hidden text-[11px] text-gray-400 truncate -mt-1 pl-7">
                      {invite.invited_email}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {rows.length === 0 && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-semibold text-gray-500 mb-1">No roles defined</p>
              <p className="text-xs text-gray-400">Use "Invite Participant" to add participants.</p>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          🔒 Each participant receives a unique secure link scoped to their role.{' '}
          {isV2
            ? 'Participants verify with a code sent to their email — no PIN to share manually.'
            : 'Kontra emails the invite link directly.'}
        </p>
      </div>

      {/* Invite modal */}
      <InviteModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          loadInvites().catch(() => {});
        }}
        prefilledRoleKey={modalRole}
        roles={invitableRoles}
        isV2={isV2}
        onSend={handleSend}
      />
    </div>
  );
}
