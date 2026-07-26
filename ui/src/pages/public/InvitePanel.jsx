import { useState } from 'react';
import { getWorkflowPack, DEFAULT_PACK_ID } from '../../lib/workflowPacks';
import {
  checkPinExists,
  generatePinForRole,
  requestOwnerOtp,
  verifyOwnerOtp,
} from '../../lib/pinUtils';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function getInvitableRoles(packId) {
  return getWorkflowPack(packId).roles
    .filter(r => r.invitable)
    .map(r => ({ role: r.key, icon: r.icon, label: r.shortLabel || r.label, action: r.inviteAction }));
}

// ── PIN generation inline flow ────────────────────────────────────────────────
// Renders inside a role card after invite is sent or link is copied.
// phase: 'nudge' | 'email' | 'otp-sent' | 'generating' | 'revealed'
function PinFlow({ propertyId, roleKey, onDone }) {
  const [phase,       setPhase]       = useState('nudge');
  const [ownerEmail,  setOwnerEmail]  = useState('');
  const [otp,         setOtp]         = useState('');
  const [pin,         setPin]         = useState('');
  const [err,         setErr]         = useState('');
  const [loading,     setLoading]     = useState(false);

  async function handleSendOtp(e) {
    e.preventDefault();
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) { setErr('Enter your email address'); return; }
    setLoading(true); setErr('');
    try {
      await requestOwnerOtp(ownerEmail.trim());
      setPhase('otp-sent');
    } catch (ex) {
      setErr(ex.message || 'Could not send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (!otp.trim()) { setErr('Enter the code'); return; }
    setLoading(true); setErr('');
    try {
      await verifyOwnerOtp(ownerEmail.trim(), otp.trim());
      setPhase('generating');
      const generated = await generatePinForRole(propertyId, roleKey);
      setPin(generated);
      setPhase('revealed');
      if (onDone) onDone();
    } catch (ex) {
      setErr(ex.message || 'Verification failed');
      setPhase('otp-sent');
    } finally {
      setLoading(false);
    }
  }

  if (phase === 'nudge') {
    return (
      <div className="mt-2.5 border-t border-amber-100 pt-2.5">
        <div className="flex items-start gap-2">
          <span className="text-sm shrink-0 mt-0.5">🔒</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-amber-800 leading-tight">Link unprotected</p>
            <p className="text-[9px] text-amber-600 mt-0.5 leading-tight">Anyone with this link can access the deal room.</p>
          </div>
          <button
            onClick={() => setPhase('email')}
            className="shrink-0 text-[9px] font-bold text-white bg-amber-500 hover:bg-amber-600 transition rounded-lg px-2 py-1">
            Generate PIN
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'email') {
    return (
      <div className="mt-2.5 border-t border-gray-100 pt-2.5">
        <p className="text-[10px] font-semibold text-gray-700 mb-1.5">Verify your identity to generate a PIN</p>
        <form onSubmit={handleSendOtp} className="space-y-1.5">
          <input
            autoFocus type="email" placeholder="your@email.com"
            value={ownerEmail}
            onChange={e => { setOwnerEmail(e.target.value); setErr(''); }}
            className="w-full text-[10px] px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
          />
          {err && <p className="text-[9px] text-red-500">{err}</p>}
          <div className="flex gap-1.5">
            <button type="submit" disabled={loading}
              className="flex-1 py-1 rounded-lg text-[10px] font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
              {loading ? 'Sending…' : 'Send code →'}
            </button>
            <button type="button" onClick={() => setPhase('nudge')}
              className="px-2 py-1 rounded-lg text-[10px] text-gray-400 border border-gray-200 hover:text-gray-600 transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (phase === 'otp-sent') {
    return (
      <div className="mt-2.5 border-t border-gray-100 pt-2.5">
        <p className="text-[10px] font-semibold text-gray-700 mb-0.5">Enter the code sent to your email</p>
        <p className="text-[9px] text-gray-400 mb-1.5">{ownerEmail}</p>
        <form onSubmit={handleVerifyOtp} className="space-y-1.5">
          <input
            autoFocus type="text" inputMode="numeric" placeholder="6-digit code"
            value={otp}
            onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }}
            className="w-full text-[10px] px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300 tracking-widest font-mono"
          />
          {err && <p className="text-[9px] text-red-500">{err}</p>}
          <div className="flex gap-1.5">
            <button type="submit" disabled={loading || otp.length < 6}
              className="flex-1 py-1 rounded-lg text-[10px] font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
              {loading ? 'Verifying…' : 'Verify →'}
            </button>
            <button type="button" onClick={() => { setPhase('email'); setOtp(''); setErr(''); }}
              className="px-2 py-1 rounded-lg text-[10px] text-gray-400 border border-gray-200 hover:text-gray-600 transition">
              ← Back
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (phase === 'generating') {
    return (
      <div className="mt-2.5 border-t border-gray-100 pt-2.5 flex items-center gap-2">
        <div className="w-3 h-3 border border-[#800020]/30 border-t-[#800020] rounded-full animate-spin shrink-0" />
        <p className="text-[10px] text-gray-500">Generating PIN…</p>
      </div>
    );
  }

  if (phase === 'revealed') {
    return (
      <div className="mt-2.5 border-t border-green-100 pt-2.5">
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
          <p className="text-[9px] text-green-600 font-medium mb-0.5">Share this PIN with the participant</p>
          <p className="text-xl font-bold text-green-800 tracking-[0.3em] font-mono">{pin}</p>
          <p className="text-[8px] text-green-500 mt-0.5">Shown once — copy it now</p>
        </div>
      </div>
    );
  }

  return null;
}

// ── Role card ─────────────────────────────────────────────────────────────────
function RoleCard({ r, propertyId, senderName, onRemove }) {
  const [email,        setEmail]       = useState('');
  const [status,       setStatus]      = useState('idle');
  const [errMsg,       setErrMsg]      = useState('');
  const [copied,       setCopied]      = useState(false);

  // PIN check state
  const [pinExists,    setPinExists]   = useState(null); // null=unknown, true/false
  const [pinChecked,   setPinChecked]  = useState(false);
  const [pinGenerated, setPinGenerated] = useState(false);

  const url = `${window.location.origin}/deal-room/${propertyId}?role=${r.role}`;

  async function probePin() {
    if (pinChecked) return;
    setPinChecked(true);
    const exists = await checkPinExists(propertyId, r.role);
    setPinExists(exists);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { setErrMsg('Enter a valid email'); return; }
    setStatus('loading');
    setErrMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: r.role, email: email.trim(), senderName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      setStatus('sent');
      probePin(); // check PIN after successful invite
    } catch (err) {
      setErrMsg(err.message);
      setStatus('error');
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      probePin(); // check PIN after link is copied
    });
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base">{r.icon}</span>
          <p className="text-xs font-bold text-green-800 flex-1 min-w-0">{r.label}</p>
          <span className="text-[9px] font-bold text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5 shrink-0">✓ Invited</span>
        </div>
        <p className="text-[10px] text-green-600">Sent to <span className="font-semibold">{email}</span></p>
        <p className="text-[10px] text-gray-400 mt-0.5">Awaiting documents</p>
        <button onClick={() => { setStatus('idle'); setEmail(''); setPinChecked(false); setPinExists(null); }}
          className="text-[9px] text-green-500 underline mt-1.5 block">Send to another →</button>

        {/* PIN nudge — shown when no PIN is set and owner hasn't generated one yet */}
        {pinExists === false && !pinGenerated && (
          <PinFlow
            propertyId={propertyId}
            roleKey={r.role}
            onDone={() => setPinGenerated(true)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 group/card relative">
      {/* Remove button — hover reveal */}
      {onRemove && (
        <button
          onClick={onRemove}
          title="Hide this role"
          className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 text-gray-200 hover:text-red-400 transition text-xs leading-none">
          ✕
        </button>
      )}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base">{r.icon}</span>
        <p className="text-xs font-semibold text-gray-800">{r.label}</p>
      </div>
      <form onSubmit={handleSend} className="space-y-1.5">
        <input
          type="email"
          placeholder={`${r.label.toLowerCase()}@firm.com`}
          value={email}
          onChange={e => { setEmail(e.target.value); setErrMsg(''); setStatus('idle'); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        {errMsg && <p className="text-[9px] text-red-500">{errMsg}</p>}
        <div className="flex items-center gap-1.5">
          <button type="submit" disabled={status === 'loading' || !email.trim()}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {status === 'loading' ? 'Sending…' : 'Send Invite →'}
          </button>
          <button type="button" onClick={handleCopy} title="Copy link instead"
            className="px-2 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition shrink-0">
            {copied ? '✓' : '🔗'}
          </button>
        </div>
      </form>

      {/* PIN nudge after copy — shown inline below the form */}
      {pinExists === false && !pinGenerated && (
        <PinFlow
          propertyId={propertyId}
          roleKey={r.role}
          onDone={() => setPinGenerated(true)}
        />
      )}
    </div>
  );
}

// ── Custom / free-form party card ─────────────────────────────────────────────
function CustomPartyCard({ propertyId, senderName }) {
  const [open,   setOpen]   = useState(false);
  const [label,  setLabel]  = useState('');
  const [email,  setEmail]  = useState('');
  const [status, setStatus] = useState('idle');
  const [errMsg, setErrMsg] = useState('');
  const [copied, setCopied] = useState(false);

  function reset() { setOpen(false); setLabel(''); setEmail(''); setStatus('idle'); setErrMsg(''); }

  function getRoleKey() {
    return label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32) || 'guest';
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!label.trim()) { setErrMsg('Enter a role name'); return; }
    if (!email.trim() || !email.includes('@')) { setErrMsg('Enter a valid email'); return; }
    setStatus('loading');
    setErrMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: getRoleKey(), email: email.trim(), senderName, customLabel: label.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      setStatus('sent');
    } catch (err) {
      setErrMsg(err.message);
      setStatus('error');
    }
  }

  function handleCopy() {
    const url = `${window.location.origin}/deal-room/${propertyId}?role=${getRoleKey()}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base">👤</span>
          <p className="text-xs font-bold text-green-800 flex-1 min-w-0">{label}</p>
          <span className="text-[9px] font-bold text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5 shrink-0">✓ Invited</span>
        </div>
        <p className="text-[10px] text-green-600">Sent to <span className="font-semibold">{email}</span></p>
        <p className="text-[10px] text-gray-400 mt-0.5">Awaiting documents</p>
        <button onClick={reset} className="text-[9px] text-green-500 underline mt-1.5 block">Send to another →</button>
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
        <button onClick={() => { setOpen(false); setLabel(''); setEmail(''); setErrMsg(''); }}
          className="ml-auto text-gray-300 hover:text-gray-500 text-xs transition">✕</button>
      </div>
      <form onSubmit={handleSend} className="space-y-1.5">
        <input autoFocus type="text" placeholder="Their role (e.g. IP Counsel)"
          value={label} onChange={e => { setLabel(e.target.value); setErrMsg(''); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        <input type="email" placeholder="email@firm.com"
          value={email} onChange={e => { setEmail(e.target.value); setErrMsg(''); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        {errMsg && <p className="text-[9px] text-red-500">{errMsg}</p>}
        <div className="flex items-center gap-1.5">
          <button type="submit" disabled={status === 'loading' || !label.trim() || !email.trim()}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {status === 'loading' ? 'Sending…' : 'Send Invite →'}
          </button>
          <button type="button" onClick={handleCopy} title="Copy link instead"
            className="px-2 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition shrink-0">
            {copied ? '✓' : '🔗'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export default function InvitePanel({ propertyId, senderName, packId = DEFAULT_PACK_ID }) {
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

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 px-6 py-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-900">Request documents from each party</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Enter their email — they'll get a direct upload link for their role. No account required.
          </p>
        </div>
        {removedRoles.size > 0 && (
          <button onClick={handleRestoreRoles}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline transition shrink-0 mt-0.5">
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
            senderName={senderName}
            onRemove={() => handleRemoveRole(r.role)}
          />
        ))}
        <CustomPartyCard propertyId={propertyId} senderName={senderName} />
      </div>
      <p className="text-[10px] text-gray-400 mt-3 text-center">
        Each party sees only what's relevant to their role · 🔗 button copies the link instead
      </p>
    </div>
  );
}
