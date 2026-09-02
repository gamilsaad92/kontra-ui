/**
 * InvitePanelV2.jsx — Owner invite management (security v2).
 *
 * Features:
 *   - Create per-participant invites (one per email per role)
 *   - Kontra emails the invite link automatically
 *   - Participant verifies via email OTP — no PIN distribution needed
 *   - Manage: list active invites, revoke roles, reissue expired invites
 *   - Categorized audit log view (security / authorization / document_activity)
 */

import { useState, useEffect, useCallback } from 'react';
import { getWorkflowPack, DEFAULT_PACK_ID } from '../../lib/workflowPacks';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

async function apiCall(method, path, body, authToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function getInvitableRoles(packId) {
  try {
    return getWorkflowPack(packId).roles
      .filter(r => r.invitable !== false)
      .map(r => ({ key: r.key, icon: r.icon, label: r.shortLabel || r.label }));
  } catch {
    return [
      { key: 'buyer',    icon: '🏢', label: 'Buyer' },
      { key: 'lender',   icon: '🏦', label: 'Lender' },
      { key: 'attorney', icon: '⚖️', label: 'Attorney' },
    ];
  }
}

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

const STATUS_BADGE = {
  pending:    { bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'Pending' },
  accepted:   { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Active' },
  revoked:    { bg: 'bg-red-50',    text: 'text-red-600',    label: 'Revoked' },
  expired:    { bg: 'bg-gray-100',  text: 'text-gray-500',   label: 'Expired' },
  superseded: { bg: 'bg-gray-100',  text: 'text-gray-400',   label: 'Reissued' },
};

// ── Create invite form ────────────────────────────────────────────────────────

function CreateInviteForm({ roomId, ownerToken, packId, onCreated }) {
  const roles = getInvitableRoles(packId);
  const [roleKey,  setRoleKey]  = useState(roles[0]?.key || '');
  const [email,    setEmail]    = useState('');
  const [status,   setStatus]   = useState('idle'); // idle | loading | done | error
  const [errMsg,   setErrMsg]   = useState('');
  const [customRole, setCustomRole] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const effectiveRoleKey = showCustom
    ? customRole.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32) || 'guest'
    : roleKey;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { setErrMsg('Enter a valid email'); return; }
    if (showCustom && !customRole.trim())       { setErrMsg('Enter a role name');   return; }
    setStatus('loading'); setErrMsg('');

    const result = await apiCall('POST', '/api/v2/deal-room/invite/create', {
      roomId,
      roleKey:      effectiveRoleKey,
      invitedEmail: email.trim(),
    }, ownerToken);

    if (!result.ok) {
      setErrMsg(result.error || 'Failed to create invite');
      setStatus('error');
      return;
    }

    setStatus('done');
    setEmail('');
    setCustomRole('');
    setShowCustom(false);
    onCreated?.();
  }

  if (status === 'done') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-xs font-bold text-green-800 mb-0.5">✓ Invite sent</p>
        <p className="text-[10px] text-green-600">
          Kontra emailed the invite link. Participant verifies via the code sent to their email.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-2 text-[10px] text-green-700 underline"
        >
          Invite another →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {/* Role selector */}
      <div className="flex flex-wrap gap-1.5">
        {roles.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => { setRoleKey(r.key); setShowCustom(false); setErrMsg(''); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
              !showCustom && roleKey === r.key
                ? 'bg-[#800020] text-white border-[#800020]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <span>{r.icon}</span> {r.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setShowCustom(true); setErrMsg(''); }}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
            showCustom
              ? 'bg-[#800020] text-white border-[#800020]'
              : 'bg-white text-gray-500 border-dashed border-gray-300 hover:border-gray-400'
          }`}
        >
          + Custom
        </button>
      </div>

      {showCustom && (
        <input
          autoFocus
          type="text"
          placeholder="Their role (e.g. IP Counsel)"
          value={customRole}
          onChange={e => { setCustomRole(e.target.value); setErrMsg(''); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
      )}

      <div className="flex gap-2">
        <input
          type="email"
          placeholder="participant@firm.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setErrMsg(''); }}
          className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40"
        >
          {status === 'loading' ? '…' : 'Invite'}
        </button>
      </div>

      {errMsg && <p className="text-[10px] text-red-500">{errMsg}</p>}

      <p className="text-[9px] text-gray-400 leading-snug">
        Kontra emails the invite link. Participant verifies via a code sent to their email — nothing to share separately.
      </p>
    </form>
  );
}

// ── Invite list ───────────────────────────────────────────────────────────────

function InviteList({ roomId, ownerToken, refresh, onRefresh }) {
  const [invites,  setInvites]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [revoking, setRevoking] = useState(null);
  const [reissuing,setReissuing]= useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall('GET', `/api/v2/deal-room/invites/${roomId}`, null, ownerToken);
      setInvites(data.invites || []);
    } catch { setInvites([]); }
    setLoading(false);
  }, [roomId, ownerToken]);

  useEffect(() => { load(); }, [load, refresh]);

  async function handleRevoke(inviteId) {
    setRevoking(inviteId);
    await apiCall('POST', '/api/v2/deal-room/invite/revoke', { roomId, inviteId }, ownerToken);
    await load();
    setRevoking(null);
    onRefresh?.();
  }

  async function handleReissue(inviteId) {
    setReissuing(inviteId);
    await apiCall('POST', '/api/v2/deal-room/invite/reissue', { roomId, inviteId }, ownerToken);
    await load();
    setReissuing(null);
    onRefresh?.();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
        <div className="w-4 h-4 border border-gray-200 border-t-[#800020] rounded-full animate-spin" />
        Loading invites…
      </div>
    );
  }

  if (!invites.length) {
    return (
      <div className="text-center py-6">
        <p className="text-sm font-semibold text-gray-400">No invites yet</p>
        <p className="text-xs text-gray-300 mt-1">Create an invite above to add participants.</p>
      </div>
    );
  }

  const active   = invites.filter(i => ['pending','accepted'].includes(i.status));
  const inactive = invites.filter(i => !['pending','accepted'].includes(i.status));

  const renderRow = (inv) => {
    const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.pending;
    return (
      <div key={inv.id} className="flex items-start gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-xs font-semibold text-gray-800 truncate">
              {inv.role_key?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 truncate">{inv.invited_email}</p>
          <p className="text-[9px] text-gray-300 mt-0.5">
            Created {timeAgo(inv.created_at)}
            {inv.status === 'accepted' && ' · Active'}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {['expired','superseded'].includes(inv.status) && (
            <button
              onClick={() => handleReissue(inv.id)}
              disabled={reissuing === inv.id}
              className="text-[10px] font-semibold text-[#800020] hover:opacity-80 border border-[#800020]/20 px-2 py-1 rounded-lg transition disabled:opacity-40"
            >
              {reissuing === inv.id ? '…' : 'Reissue'}
            </button>
          )}
          {['pending','accepted'].includes(inv.status) && (
            <button
              onClick={() => handleRevoke(inv.id)}
              disabled={revoking === inv.id}
              className="text-[10px] font-semibold text-red-400 hover:text-red-600 border border-red-200 hover:border-red-300 px-2 py-1 rounded-lg transition disabled:opacity-40"
            >
              {revoking === inv.id ? '…' : 'Revoke'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {active.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 divide-y divide-gray-50">
          {active.map(renderRow)}
        </div>
      )}
      {inactive.length > 0 && (
        <details>
          <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 py-1 px-1 list-none select-none">
            {inactive.length} expired / revoked / reissued ▾
          </summary>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 mt-1 divide-y divide-gray-100">
            {inactive.map(renderRow)}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Audit log ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  security:          { label: 'Security',           color: 'text-red-600',    bg: 'bg-red-50' },
  authorization:     { label: 'Authorization',      color: 'text-amber-700',  bg: 'bg-amber-50' },
  document_activity: { label: 'Document Activity',  color: 'text-blue-700',   bg: 'bg-blue-50' },
};

function AuditLog({ roomId, ownerToken }) {
  const [events,   setEvents]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [category, setCategory] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (category) params.set('category', category);
    apiCall('GET', `/api/v2/deal-room/audit-log/${roomId}?${params}`, null, ownerToken)
      .then(data => { setEvents(data.events || []); setLoading(false); })
      .catch(() => { setEvents([]); setLoading(false); });
  }, [roomId, ownerToken, category]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {[['', 'All'], ...Object.entries(CATEGORY_LABELS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setCategory(k)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition ${
              category === k
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 py-3">Loading…</div>
      ) : !events.length ? (
        <div className="text-xs text-gray-400 py-3 text-center">No events recorded yet.</div>
      ) : (
        <div className="space-y-1">
          {events.map(ev => {
            const cat = CATEGORY_LABELS[ev.event_category] || CATEGORY_LABELS.security;
            return (
              <div key={ev.id} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cat.bg} ${cat.color} shrink-0 mt-0.5`}>
                  {ev.event_type.replace(/_/g, ' ')}
                </span>
                <div className="flex-1 min-w-0">
                  {(ev.actor_email || ev.target_email) && (
                    <p className="text-[10px] text-gray-500 truncate">
                      {ev.actor_email && <span>{ev.actor_email}</span>}
                      {ev.actor_email && ev.target_email && <span className="text-gray-300"> → </span>}
                      {ev.target_email && <span>{ev.target_email}</span>}
                    </p>
                  )}
                  <p className="text-[9px] text-gray-300">{timeAgo(ev.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function InvitePanelV2({ roomId, packId = DEFAULT_PACK_ID }) {
  const [tab,     setTab]     = useState('invite'); // invite | manage | audit
  const [refresh, setRefresh] = useState(0);
  // Get owner token from Supabase session dynamically — no prop needed
  const [ownerToken, setOwnerToken] = useState(null);
  useEffect(() => {
    import('../../lib/supabaseClient').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setOwnerToken(session?.access_token || null);
      });
    });
  }, []);

  return (
    <div className="space-y-3">
      {/* Info callout */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <p className="text-[11px] font-semibold text-blue-800 mb-0.5">🔐 Secure per-person invitations</p>
        <p className="text-[10px] text-blue-600 leading-relaxed">
          Each participant receives a unique invite link. They verify via a code sent to their email.
          No PIN to distribute manually.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1">
        {[
          { key: 'invite', label: 'Invite' },
          { key: 'manage', label: 'Manage' },
          { key: 'audit',  label: 'Audit Log' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              tab === t.key
                ? 'bg-[#800020] text-white'
                : 'text-gray-400 border border-gray-200 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'invite' && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
          <CreateInviteForm
            roomId={roomId}
            ownerToken={ownerToken}
            packId={packId}
            onCreated={() => setRefresh(r => r + 1)}
          />
        </div>
      )}

      {tab === 'manage' && (
        <InviteList
          roomId={roomId}
          ownerToken={ownerToken}
          refresh={refresh}
          onRefresh={() => setRefresh(r => r + 1)}
        />
      )}

      {tab === 'audit' && (
        <AuditLog roomId={roomId} ownerToken={ownerToken} />
      )}
    </div>
  );
}
