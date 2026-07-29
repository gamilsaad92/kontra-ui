/**
 * InvitePanel — owner-facing invite creation and management.
 *
 * Security model (two-channel):
 *   Channel 1 — Kontra emails the participant an invite LINK (no PIN).
 *   Channel 2 — Owner sees the PIN once here and shares it separately
 *               (phone, text, WhatsApp — never the same message as the link).
 *
 * Participant needs BOTH channels to enter the deal room.
 *
 * Flow:
 *   1. Owner authenticates via email OTP (Supabase Auth).
 *   2. Owner enters participant email + creates invite.
 *   3. Kontra sends invite email with the link (no PIN) automatically.
 *   4. PIN is shown once to the owner — copy and share out-of-band.
 *   5. "Manage" tab lists all active invites with revoke actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { getWorkflowPack, DEFAULT_PACK_ID } from '../../lib/workflowPacks';
import {
  createInvite,
  generatePin,
  getRoomInvites,
  revokeInvite,
} from '../../lib/inviteUtils';
import { supabase } from '../../lib/supabaseClient';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

function getInvitableRoles(packId) {
  return getWorkflowPack(packId).roles
    .filter(r => r.invitable)
    .map(r => ({ role: r.key, icon: r.icon, label: r.shortLabel || r.label }));
}

// ── Created-invite card ───────────────────────────────────────────────────────

function CreatedInviteCard({ inviteUrl, pin, email, emailSent, emailErr, onDismiss }) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [pinCopied, setPinCopied]   = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  }

  function copyPin() {
    navigator.clipboard.writeText(pin).then(() => {
      setPinCopied(true);
      setTimeout(() => setPinCopied(false), 2500);
    });
  }

  return (
    <div className="space-y-3">

      {/* Channel 1 — invite link (Kontra already emailed this) */}
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-sm">✉️</span>
          <p className="text-xs font-bold text-green-800 flex-1">
            {emailSent ? `Invite link sent to ${email}` : 'Invite link'}
          </p>
          <button onClick={onDismiss} className="text-green-400 hover:text-green-600 text-xs transition">✕</button>
        </div>
        {emailErr && (
          <p className="text-[10px] text-red-500">Email failed: {emailErr} — copy and send the link manually.</p>
        )}
        <div className="bg-white border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <p className="text-[10px] text-gray-400 flex-1 truncate font-mono">{inviteUrl}</p>
          <button onClick={copyLink}
            className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg transition"
            style={linkCopied ? { background: '#16a34a', color: 'white' } : { background: '#f3f4f6', color: '#374151' }}>
            {linkCopied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-[9px] text-green-600">
          The participant uses this link to reach the PIN entry screen.
        </p>
      </div>

      {/* Channel 2 — PIN (owner shares separately, never in same message) */}
      <div className="rounded-xl border border-[#800020]/20 bg-[#800020]/5 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[#800020] text-sm">🔑</span>
          <p className="text-xs font-bold text-[#800020]">Access PIN — share separately</p>
        </div>

        <div className="bg-white border border-[#800020]/20 rounded-lg px-3 py-3 flex items-center gap-3">
          <p className="text-2xl font-bold text-gray-900 tracking-[0.35em] font-mono flex-1">{pin}</p>
          <button onClick={copyPin}
            className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg transition"
            style={pinCopied ? { background: '#800020', color: 'white' } : { background: '#f3f4f6', color: '#374151' }}>
            {pinCopied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-[10px] font-semibold text-amber-800">
            ⚠ Do NOT send this PIN in the same message as the invite link.
          </p>
          <p className="text-[9px] text-amber-600 mt-0.5 leading-relaxed">
            Call them, text it separately, or hand it in person. Both are required to enter — that's the security.
          </p>
        </div>

        <p className="text-[9px] text-gray-400">Shown once — not stored anywhere you can retrieve it later.</p>
      </div>
    </div>
  );
}

// ── Role invite card ──────────────────────────────────────────────────────────

function RoleCard({ r, propertyId, onRemove }) {
  const [email, setEmail]           = useState('');
  const [status, setStatus]         = useState('idle'); // idle | loading | created | error
  const [errMsg, setErrMsg]         = useState('');
  const [createdData, setCreatedData] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { setErrMsg('Enter a valid email address'); return; }
    setStatus('loading'); setErrMsg('');

    const pin = generatePin();
    const result = await createInvite({
      propertyId,
      roleKey: r.role,
      invitedEmail: email.trim(),
      verificationMethod: 'pin',
      pin,
    });

    if (!result.success) {
      setErrMsg(
        result.error === 'not_owner'     ? 'You must be signed in as the deal owner to create invites.' :
        result.error === 'token_conflict' ? 'Token conflict — please try again.' :
        result.error || 'Failed to create invite'
      );
      setStatus('error');
      return;
    }

    const inviteUrl = `${window.location.origin}/deal-room/${propertyId}?invite=${result.invite_token}&role=${r.role}`;

    // Email is sent by the create-invite endpoint — use its response
    const emailSent = result.emailSent ?? false;
    const emailErr  = emailSent ? '' : (invitedEmail ? 'Email may not have sent' : '');

    setCreatedData({ inviteUrl, pin, email: email.trim(), emailSent, emailErr });
    setStatus('created');
  }

  if (status === 'created' && createdData) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{r.icon}</span>
          <p className="text-xs font-semibold text-gray-800 flex-1">{r.label}</p>
        </div>
        <CreatedInviteCard
          {...createdData}
          onDismiss={() => { setStatus('idle'); setEmail(''); setErrMsg(''); setCreatedData(null); }}
        />
        <button
          onClick={() => { setStatus('idle'); setEmail(''); setErrMsg(''); setCreatedData(null); }}
          className="text-[10px] text-[#800020] underline">
          Invite another {r.label} →
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 group/card relative">
      {onRemove && (
        <button onClick={onRemove} title="Hide this role"
          className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 text-gray-200 hover:text-red-400 transition text-xs leading-none">
          ✕
        </button>
      )}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base">{r.icon}</span>
        <p className="text-xs font-semibold text-gray-800">{r.label}</p>
      </div>

      <form onSubmit={handleCreate} className="space-y-1.5">
        <input
          type="email" placeholder={`${r.label.toLowerCase()}@firm.com`}
          value={email}
          onChange={e => { setEmail(e.target.value); setErrMsg(''); setStatus('idle'); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        <p className="text-[9px] text-gray-400 leading-snug">
          Kontra will email the invite link directly to the participant.
        </p>
        {errMsg && <p className="text-[9px] text-red-500">{errMsg}</p>}
        <button type="submit" disabled={status === 'loading'}
          className="w-full py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
          {status === 'loading' ? 'Creating…' : 'Create invite →'}
        </button>
      </form>
    </div>
  );
}

// ── Custom party card ─────────────────────────────────────────────────────────

function CustomPartyCard({ propertyId }) {
  const [open, setOpen]               = useState(false);
  const [label, setLabel]             = useState('');
  const [email, setEmail]             = useState('');
  const [status, setStatus]           = useState('idle');
  const [errMsg, setErrMsg]           = useState('');
  const [createdData, setCreatedData] = useState(null);

  function getRoleKey() {
    return label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32) || 'guest';
  }

  function reset() { setOpen(false); setLabel(''); setEmail(''); setStatus('idle'); setErrMsg(''); setCreatedData(null); }

  async function handleCreate(e) {
    e.preventDefault();
    if (!label.trim())                                  { setErrMsg('Enter a role name'); return; }
    if (!email.trim() || !email.includes('@'))          { setErrMsg('Enter a valid email'); return; }
    setStatus('loading'); setErrMsg('');

    const roleKey = getRoleKey();
    const pin = generatePin();
    const result = await createInvite({
      propertyId,
      roleKey,
      invitedEmail: email.trim(),
      verificationMethod: 'pin',
      pin,
    });

    if (!result.success) {
      setErrMsg(result.error || 'Failed to create invite');
      setStatus('error');
      return;
    }

    const inviteUrl = `${window.location.origin}/deal-room/${propertyId}?invite=${result.invite_token}&role=${roleKey}`;

    const emailSent = result.emailSent ?? false;
    const emailErr  = emailSent ? '' : (email.trim() ? 'Email may not have sent' : '');

    setCreatedData({ inviteUrl, pin, email: email.trim(), emailSent, emailErr });
    setStatus('created');
  }

  if (status === 'created' && createdData) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">👤</span>
          <p className="text-xs font-semibold text-gray-800 flex-1">{label}</p>
        </div>
        <CreatedInviteCard {...createdData} onDismiss={reset} />
        <button onClick={reset} className="text-[10px] text-[#800020] underline">Invite another →</button>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 flex flex-col items-center justify-center gap-1 w-full hover:border-gray-300 hover:bg-gray-50 transition group"
        style={{ minHeight: 90 }}>
        <span className="text-lg text-gray-300 group-hover:text-gray-400 transition">+</span>
        <p className="text-[11px] font-medium text-gray-400 group-hover:text-gray-500">Invite someone else</p>
        <p className="text-[10px] text-gray-300 group-hover:text-gray-400">Custom role</p>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base">👤</span>
        <p className="text-xs font-semibold text-gray-700">Custom party</p>
        <button onClick={reset} className="ml-auto text-gray-300 hover:text-gray-500 text-xs transition">✕</button>
      </div>
      <form onSubmit={handleCreate} className="space-y-1.5">
        <input autoFocus type="text" placeholder="Their role (e.g. IP Counsel)"
          value={label} onChange={e => { setLabel(e.target.value); setErrMsg(''); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        <input type="email" placeholder="email@firm.com"
          value={email} onChange={e => { setEmail(e.target.value); setErrMsg(''); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        <p className="text-[9px] text-gray-400 leading-snug">
          Kontra emails the invite link directly to the participant.
        </p>
        {errMsg && <p className="text-[9px] text-red-500">{errMsg}</p>}
        <button type="submit" disabled={status === 'loading'}
          className="w-full py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
          {status === 'loading' ? 'Creating…' : 'Create invite →'}
        </button>
      </form>
    </div>
  );
}

// ── Invite management table ───────────────────────────────────────────────────

const STATUS_STYLE = {
  pending:  { bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'Pending' },
  accepted: { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Active' },
  revoked:  { bg: 'bg-red-50',    text: 'text-red-600',    label: 'Revoked' },
  expired:  { bg: 'bg-gray-100',  text: 'text-gray-500',   label: 'Expired' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function InviteManagementTable({ propertyId, packId }) {
  const [invites, setInvites]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [revoking, setRevoking] = useState(null);

  const allRoles = getWorkflowPack(packId).roles;
  function getRoleLabel(roleKey) {
    const r = allRoles.find(r => r.key === roleKey);
    return r ? (r.shortLabel || r.label) : roleKey;
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await getRoomInvites(propertyId);
    setInvites(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleRevoke(inviteId) {
    setRevoking(inviteId);
    await revokeInvite(inviteId);
    await refresh();
    setRevoking(null);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
        <div className="w-4 h-4 border border-gray-200 border-t-[#800020] rounded-full animate-spin" />
        Loading invites…
      </div>
    );
  }

  const active   = invites.filter(i => i.status !== 'revoked' && i.status !== 'expired');
  const inactive = invites.filter(i => i.status === 'revoked' || i.status === 'expired');

  if (invites.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm font-semibold text-gray-500 mb-1">No invites yet</p>
        <p className="text-xs text-gray-400">Switch to the Invite tab to create participant links.</p>
      </div>
    );
  }

  const renderRow = (inv) => {
    const style = STATUS_STYLE[inv.status] || STATUS_STYLE.pending;
    return (
      <div key={inv.id} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-xs font-semibold text-gray-800 truncate">{getRoleLabel(inv.role_key)}</p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
              {style.label}
            </span>
          </div>
          {inv.invited_email && (
            <p className="text-[10px] text-gray-400 truncate">{inv.invited_email}</p>
          )}
          <p className="text-[9px] text-gray-300 mt-0.5">
            Created {timeAgo(inv.created_at)}
            {inv.last_used_at ? ` · Used ${timeAgo(inv.last_used_at)}` : ''}
          </p>
        </div>
        {inv.status !== 'revoked' && inv.status !== 'expired' && (
          <button
            onClick={() => handleRevoke(inv.id)}
            disabled={revoking === inv.id}
            className="shrink-0 text-[10px] font-semibold text-red-400 hover:text-red-600 border border-red-200 hover:border-red-300 px-2 py-1 rounded-lg transition disabled:opacity-40">
            {revoking === inv.id ? '…' : 'Revoke'}
          </button>
        )}
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
        <details className="group">
          <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 py-1 px-1 list-none select-none">
            {inactive.length} expired / revoked ▾
          </summary>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 mt-1 divide-y divide-gray-100">
            {inactive.map(renderRow)}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function InvitePanel({ propertyId, packId = DEFAULT_PACK_ID }) {
  const [tab, setTab]                 = useState('invite'); // 'invite' | 'manage'
  const [hiddenRoles, setHiddenRoles] = useState([]);

  const roles = getInvitableRoles(packId).filter(r => !hiddenRoles.includes(r.role));

  return (
    <div className="space-y-3">

      {/* Invite callout */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <p className="text-[11px] font-semibold text-blue-800 mb-1">🔗 Secure per-participant invitations</p>
        <p className="text-[10px] text-blue-600 leading-relaxed">
          Each participant gets their own unique link scoped to their role.
          Kontra emails it directly — no manual sharing required.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1">
        {[{ key: 'invite', label: 'Invite' }, { key: 'manage', label: 'Manage' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              tab === t.key
                ? 'bg-[#800020] text-white'
                : 'text-gray-400 border border-gray-200 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'invite' && (
        <div className="space-y-2">
          {roles.map(r => (
            <RoleCard
              key={r.role}
              r={r}
              propertyId={propertyId}
              onRemove={() => setHiddenRoles(h => [...h, r.role])}
            />
          ))}
          <CustomPartyCard propertyId={propertyId} />
        </div>
      )}

      {tab === 'manage' && (
        <InviteManagementTable propertyId={propertyId} packId={packId} />
      )}
    </div>
  );
}
