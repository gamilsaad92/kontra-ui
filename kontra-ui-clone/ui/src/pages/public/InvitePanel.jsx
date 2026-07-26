/**
 * InvitePanel — owner-facing invite creation and management.
 *
 * Flow:
 *  1. Owner authenticates via email OTP (Supabase Auth).
 *  2. Authenticated owner can create per-participant invites (email OTP or PIN).
 *  3. Each invite gets a unique URL shown once for copying / sharing.
 *  4. "Manage" tab lists all active invites with revoke actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { getWorkflowPack, DEFAULT_PACK_ID } from '../../lib/workflowPacks';
import {
  createInvite,
  generatePin,
  getRoomInvites,
  revokeInvite,
  requestOwnerOtp,
  verifyOwnerOtp,
  getOwnerSession,
} from '../../lib/inviteUtils';
import { supabase } from '../../lib/supabaseClient';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

function getInvitableRoles(packId) {
  return getWorkflowPack(packId).roles
    .filter(r => r.invitable)
    .map(r => ({ role: r.key, icon: r.icon, label: r.shortLabel || r.label }));
}

// ── Owner OTP auth gate ───────────────────────────────────────────────────────

function OwnerAuthGate({ onAuthenticated }) {
  const [phase, setPhase]         = useState('email'); // email | otp_sent | working
  const [email, setEmail]         = useState('');
  const [otp, setOtp]             = useState('');
  const [err, setErr]             = useState('');
  const [loading, setLoading]     = useState(false);

  async function handleSendOtp(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { setErr('Enter your email address'); return; }
    setLoading(true); setErr('');
    try {
      await requestOwnerOtp(email.trim());
      setPhase('otp_sent');
    } catch (ex) {
      setErr(ex.message || 'Could not send verification code');
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (otp.length < 6) { setErr('Enter the 6-digit code'); return; }
    setLoading(true); setErr('');
    try {
      const session = await verifyOwnerOtp(email.trim(), otp.trim());
      onAuthenticated(session);
    } catch (ex) {
      setErr(ex.message || 'Invalid code — try again');
      setLoading(false);
    }
  }

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 px-6 py-5">
      <div className="mb-4">
        <p className="text-sm font-bold text-gray-900">Invite participants</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Verify your identity to create secure, per-person invite links.
        </p>
      </div>

      {phase === 'email' && (
        <form onSubmit={handleSendOtp} className="space-y-2 max-w-xs">
          <input
            autoFocus type="email" placeholder="your@email.com"
            value={email} onChange={e => { setEmail(e.target.value); setErr(''); }}
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
          />
          {err && <p className="text-[10px] text-red-500">{err}</p>}
          <button type="submit" disabled={loading || !email.trim()}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
            {loading ? 'Sending…' : 'Send verification code →'}
          </button>
        </form>
      )}

      {phase === 'otp_sent' && (
        <form onSubmit={handleVerifyOtp} className="space-y-2 max-w-xs">
          <p className="text-xs text-gray-500 mb-1">Enter the code sent to <strong>{email}</strong></p>
          <input
            autoFocus type="text" inputMode="numeric" maxLength={6}
            placeholder="6-digit code"
            value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }}
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300 tracking-widest font-mono"
          />
          {err && <p className="text-[10px] text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading || otp.length < 6}
              className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
              {loading ? 'Verifying…' : 'Verify →'}
            </button>
            <button type="button" onClick={() => { setPhase('email'); setOtp(''); setErr(''); }}
              className="px-3 py-2 rounded-xl text-xs text-gray-400 border border-gray-200 hover:text-gray-600 transition">
              ← Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Created-invite card — shown after an invite is created ───────────────────

// inviteToken: the raw token returned by createInvite() — sent to the API so
// it can derive the recipient, role, and URL server-side (never trusted from client).
function CreatedInviteCard({ inviteUrl, inviteToken, email, pin, method, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function handleSendEmail() {
    if (!email || !inviteToken) return;
    setSendingEmail(true); setEmailErr('');
    try {
      // Get the owner's current Supabase Auth JWT — required by the server to
      // verify ownership before it will deliver the email.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated — please refresh and try again');

      const res = await fetch(`${API_BASE}/api/public/deal-room/send-invite-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        // Server derives to/url/role/propName from the token — only token is sent
        body: JSON.stringify({ inviteToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setEmailSent(true);
    } catch (ex) {
      setEmailErr(ex.message || 'Could not send email');
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-green-600 text-base">✓</span>
        <p className="text-xs font-bold text-green-800 flex-1">Invite created</p>
        <button onClick={onDismiss} className="text-green-400 hover:text-green-600 text-xs transition">✕</button>
      </div>

      {/* Invite URL */}
      <div className="bg-white border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
        <p className="text-[10px] text-gray-500 flex-1 truncate font-mono">{inviteUrl}</p>
        <button onClick={handleCopy}
          className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg transition"
          style={copied ? { background: '#16a34a', color: 'white' } : { background: '#f3f4f6', color: '#374151' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* PIN reveal (pin method only) */}
      {method === 'pin' && pin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
          <p className="text-[10px] text-amber-700 font-medium mb-0.5">Share this PIN with the participant</p>
          <p className="text-lg font-bold text-amber-900 tracking-[0.3em] font-mono">{pin}</p>
          <p className="text-[9px] text-amber-500 mt-0.5">Shown once — copy it now</p>
        </div>
      )}

      {/* Email send button */}
      {email && method === 'email_otp' && (
        <div>
          {emailSent ? (
            <p className="text-[10px] text-green-600 font-medium">✓ Email sent to {email}</p>
          ) : (
            <div>
              <button onClick={handleSendEmail} disabled={sendingEmail}
                className="text-[10px] font-semibold text-[#800020] hover:opacity-80 transition disabled:opacity-40">
                {sendingEmail ? 'Sending…' : `Also email this link to ${email} →`}
              </button>
              {emailErr && <p className="text-[9px] text-red-500 mt-0.5">{emailErr}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Role invite card ──────────────────────────────────────────────────────────

function RoleCard({ r, propertyId, onRemove }) {
  const [email, setEmail]     = useState('');
  const [method, setMethod]   = useState('email_otp');
  const [status, setStatus]   = useState('idle'); // idle | loading | created | error
  const [errMsg, setErrMsg]   = useState('');
  const [createdData, setCreatedData] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    if (method === 'email_otp' && (!email.trim() || !email.includes('@'))) {
      setErrMsg('Enter a valid email address'); return;
    }
    setStatus('loading'); setErrMsg('');

    const pin = method === 'pin' ? generatePin() : undefined;
    const result = await createInvite({
      propertyId,
      roleKey: r.role,
      invitedEmail: method === 'email_otp' ? email.trim() : (email.trim() || null),
      verificationMethod: method,
      pin,
    });

    if (!result.success) {
      setErrMsg(result.error === 'not_owner'
        ? 'You must be signed in as the deal owner to create invites.'
        : result.error === 'token_conflict'
        ? 'Token conflict — please try again.'
        : result.error || 'Failed to create invite');
      setStatus('error');
      return;
    }

    const inviteUrl = `${window.location.origin}/deal-room/${propertyId}?invite=${result.invite_token}&role=${r.role}`;
    setCreatedData({ inviteUrl, inviteToken: result.invite_token, email: email.trim(), pin, method });
    setStatus('created');
  }

  if (status === 'created' && createdData) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{r.icon}</span>
          <p className="text-xs font-semibold text-gray-800 flex-1">{r.label}</p>
        </div>
        <CreatedInviteCard
          {...createdData}
          onDismiss={() => {
            setStatus('idle');
            setEmail(''); setErrMsg('');
            setCreatedData(null);
          }}
        />
        <button
          onClick={() => { setStatus('idle'); setEmail(''); setErrMsg(''); setCreatedData(null); }}
          className="text-[10px] text-[#800020] underline">
          Invite another →
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

        {/* Method toggle */}
        <div className="flex gap-1">
          {[{ key: 'email_otp', label: 'Email verify' }, { key: 'pin', label: 'PIN only' }].map(opt => (
            <button type="button" key={opt.key}
              onClick={() => setMethod(opt.key)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-semibold transition ${
                method === opt.key
                  ? 'bg-[#800020]/10 text-[#800020] border border-[#800020]/20'
                  : 'bg-gray-50 text-gray-400 border border-gray-200 hover:text-gray-600'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        {method === 'pin' && (
          <p className="text-[9px] text-gray-400">A 6-digit PIN is generated and shown once. Share it with the participant separately.</p>
        )}

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
  const [open, setOpen]       = useState(false);
  const [label, setLabel]     = useState('');
  const [email, setEmail]     = useState('');
  const [method, setMethod]   = useState('email_otp');
  const [status, setStatus]   = useState('idle');
  const [errMsg, setErrMsg]   = useState('');
  const [createdData, setCreatedData] = useState(null);

  function getRoleKey() {
    return label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32) || 'guest';
  }

  function reset() { setOpen(false); setLabel(''); setEmail(''); setStatus('idle'); setErrMsg(''); setCreatedData(null); }

  async function handleCreate(e) {
    e.preventDefault();
    if (!label.trim()) { setErrMsg('Enter a role name'); return; }
    if (method === 'email_otp' && (!email.trim() || !email.includes('@'))) { setErrMsg('Enter a valid email'); return; }
    setStatus('loading'); setErrMsg('');

    const roleKey = getRoleKey();
    const pin = method === 'pin' ? generatePin() : undefined;
    const result = await createInvite({
      propertyId,
      roleKey,
      invitedEmail: method === 'email_otp' ? email.trim() : (email.trim() || null),
      verificationMethod: method,
      pin,
    });

    if (!result.success) {
      setErrMsg(result.error || 'Failed to create invite');
      setStatus('error');
      return;
    }

    const inviteUrl = `${window.location.origin}/deal-room/${propertyId}?invite=${result.invite_token}&role=${roleKey}`;
    setCreatedData({ inviteUrl, inviteToken: result.invite_token, email: email.trim(), pin, method });
    setStatus('created');
  }

  if (status === 'created' && createdData) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2">
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
        <input type="email" placeholder="email@firm.com (optional for PIN method)"
          value={email} onChange={e => { setEmail(e.target.value); setErrMsg(''); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        <div className="flex gap-1">
          {[{ key: 'email_otp', label: 'Email verify' }, { key: 'pin', label: 'PIN only' }].map(opt => (
            <button type="button" key={opt.key} onClick={() => setMethod(opt.key)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-semibold transition ${
                method === opt.key ? 'bg-[#800020]/10 text-[#800020] border border-[#800020]/20' : 'bg-gray-50 text-gray-400 border border-gray-200 hover:text-gray-600'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
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
  const [invites, setInvites]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [revoking, setRevoking]   = useState(null); // invite id being revoked

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

  const active = invites.filter(i => i.status !== 'revoked' && i.status !== 'expired');
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
        {/* Role + email */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">
            {getRoleLabel(inv.role_key)}
          </p>
          <p className="text-[10px] text-gray-400 truncate">
            {inv.invited_email || (inv.verification_method === 'pin' ? 'PIN-only (no email)' : '—')}
          </p>
        </div>
        {/* Status */}
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
          {style.label}
        </span>
        {/* Last seen */}
        <span className="shrink-0 text-[10px] text-gray-400 hidden sm:block w-16 text-right">
          {inv.last_seen_at ? timeAgo(inv.last_seen_at) : inv.accepted_at ? 'Verified' : '—'}
        </span>
        {/* Actions */}
        {inv.status !== 'revoked' && inv.status !== 'expired' && (
          <button
            onClick={() => handleRevoke(inv.id)}
            disabled={revoking === inv.id}
            className="shrink-0 text-[10px] font-semibold text-red-500 hover:text-red-700 transition disabled:opacity-40">
            {revoking === inv.id ? 'Revoking…' : 'Revoke'}
          </button>
        )}
        {(inv.status === 'revoked' || inv.status === 'expired') && (
          <span className="shrink-0 text-[10px] text-gray-300">—</span>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        <span className="flex-1">Participant / Role</span>
        <span className="shrink-0 w-14">Status</span>
        <span className="shrink-0 w-16 text-right hidden sm:block">Last seen</span>
        <span className="shrink-0 w-12 text-right">Action</span>
      </div>
      {active.map(renderRow)}
      {inactive.length > 0 && (
        <details className="mt-2">
          <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 py-1">
            {inactive.length} revoked / expired
          </summary>
          {inactive.map(renderRow)}
        </details>
      )}
      <button onClick={refresh} className="mt-3 text-[10px] text-gray-400 hover:text-gray-600 underline">
        Refresh
      </button>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function InvitePanel({ propertyId, senderName, packId = DEFAULT_PACK_ID }) {
  const [ownerSession, setOwnerSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab]       = useState('invite');

  const allRoles = getInvitableRoles(packId);

  const REMOVED_KEY = propertyId ? `kontra_removed_roles_${propertyId}` : null;
  const [removedRoles, setRemovedRoles] = useState(() => {
    if (!REMOVED_KEY) return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(REMOVED_KEY) || '[]')); } catch { return new Set(); }
  });

  function handleRemoveRole(roleKey) {
    const next = new Set([...removedRoles, roleKey]);
    setRemovedRoles(next);
    if (REMOVED_KEY) localStorage.setItem(REMOVED_KEY, JSON.stringify([...next]));
  }
  function handleRestoreRoles() {
    setRemovedRoles(new Set());
    if (REMOVED_KEY) localStorage.removeItem(REMOVED_KEY);
  }
  const visibleRoles = allRoles.filter(r => !removedRoles.has(r.role));

  // Check if owner is already authenticated from a previous session
  useEffect(() => {
    getOwnerSession().then(session => {
      setOwnerSession(session);
      setCheckingAuth(false);
    }).catch(() => setCheckingAuth(false));
  }, []);

  if (checkingAuth) {
    return (
      <div className="bg-gray-50 rounded-2xl border border-gray-200 px-6 py-5">
        <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
          <div className="w-4 h-4 border border-gray-200 border-t-[#800020] rounded-full animate-spin" />
          Checking authentication…
        </div>
      </div>
    );
  }

  if (!ownerSession) {
    return <OwnerAuthGate onAuthenticated={session => setOwnerSession(session)} />;
  }

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 px-6 py-5">
      {/* Header + tabs */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-900">Participant access</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Create a unique invite link for each participant — each link is verified individually.
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {[{ key: 'invite', label: 'Invite' }, { key: 'manage', label: 'Manage' }].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                activeTab === tab.key
                  ? 'bg-[#800020] text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:text-gray-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'invite' && (
        <>
          <div className="flex items-center justify-between mb-2">
            {removedRoles.size > 0 && (
              <button onClick={handleRestoreRoles}
                className="text-[10px] text-gray-400 hover:text-gray-600 underline transition">
                Restore {removedRoles.size} hidden
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {visibleRoles.map(r => (
              <RoleCard
                key={r.role}
                r={r}
                propertyId={propertyId}
                onRemove={() => handleRemoveRole(r.role)}
              />
            ))}
            <CustomPartyCard propertyId={propertyId} />
          </div>
          <p className="text-[10px] text-gray-400 mt-3 text-center">
            Each invite creates a unique link · Email OTP confirms identity · PIN grants immediate access
          </p>
        </>
      )}

      {activeTab === 'manage' && (
        <InviteManagementTable propertyId={propertyId} packId={packId} />
      )}
    </div>
  );
}
