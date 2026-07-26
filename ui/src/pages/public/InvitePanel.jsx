import { useState, useEffect } from 'react';
import { getWorkflowPack, DEFAULT_PACK_ID } from '../../lib/workflowPacks';
import {
  generatePinForRole,
  requestOwnerOtp,
  verifyOwnerOtp,
  getOwnerSession,
} from '../../lib/pinUtils';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function getInvitableRoles(packId) {
  return getWorkflowPack(packId).roles
    .filter(r => r.invitable)
    .map(r => ({ role: r.key, icon: r.icon, label: r.shortLabel || r.label }));
}

// ── Owner auth modal (email OTP) ─────────────────────────────────────────────
// Shown the first time the owner tries to generate a PIN in this session.
function OwnerAuthModal({ onVerified, onDismiss }) {
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function handleSendOtp(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setErr('');
    try {
      await requestOwnerOtp(email);
      setStep('otp');
    } catch (ex) {
      setErr(ex.message || 'Failed to send code');
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true); setErr('');
    try {
      await verifyOwnerOtp(email, otp);
      onVerified();
    } catch (ex) {
      setErr(ex.message || 'Incorrect code');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={e => e.target === e.currentTarget && onDismiss()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-lg shrink-0">🔑</div>
          <div>
            <p className="text-sm font-bold text-gray-900">Verify room ownership</p>
            <p className="text-[11px] text-gray-400">One-time code sent to your email</p>
          </div>
          <button onClick={onDismiss} className="ml-auto text-gray-300 hover:text-gray-500 transition text-sm">✕</button>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="space-y-3">
            <p className="text-xs text-gray-500">Enter the email address you used when creating this deal room. We'll send a one-time code to confirm you're the owner.</p>
            <input
              type="email" autoFocus required
              placeholder="owner@yourdomain.com"
              value={email} onChange={e => { setEmail(e.target.value); setErr(''); }}
              className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
            />
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button type="submit" disabled={loading || !email.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
              {loading ? 'Sending…' : 'Send verification code →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <p className="text-xs text-gray-500">Check your inbox at <strong>{email}</strong> and enter the 6-digit code below.</p>
            <input
              type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus required
              placeholder="000000"
              value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setErr(''); }}
              className="w-full text-center text-2xl font-bold tracking-[0.4em] px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder:tracking-widest placeholder:text-gray-300 placeholder:text-xl"
            />
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button type="submit" disabled={loading || otp.length < 6}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
              {loading ? 'Verifying…' : 'Confirm →'}
            </button>
            <button type="button" onClick={() => { setStep('email'); setErr(''); setOtp(''); }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition">← Use a different email</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Inline PIN reveal ─────────────────────────────────────────────────────────
function PinReveal({ pin, onRegenerate, loading, error }) {
  const [pinCopied, setPinCopied] = useState(false);
  if (loading) return (
    <div className="mt-2 flex items-center gap-1.5">
      <div className="w-3 h-3 border border-amber-400 border-t-amber-700 rounded-full animate-spin shrink-0" />
      <p className="text-[10px] text-amber-600">Generating PIN…</p>
    </div>
  );
  if (error) return (
    <p className="text-[10px] text-gray-400 mt-2">
      {error}{' '}
      <button onClick={onRegenerate} className="underline text-gray-500">Retry</button>
    </p>
  );
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
      <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wide mb-1">Send PIN separately — not in the same message as the link</p>
      <div className="flex items-center gap-2">
        <span className="text-sm font-black tracking-[0.25em] text-amber-900 flex-1">{pin}</span>
        <button onClick={() => { navigator.clipboard.writeText(pin).then(() => { setPinCopied(true); setTimeout(() => setPinCopied(false), 2000); }); }}
          className={`text-[9px] font-bold px-2 py-1 rounded transition ${pinCopied ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
          {pinCopied ? '✓' : 'Copy'}
        </button>
        <button onClick={onRegenerate} className="text-[9px] text-amber-500 hover:text-amber-700 underline transition">New</button>
      </div>
      <p className="text-[8px] text-amber-500 mt-1">This PIN is shown once. Save it before closing.</p>
    </div>
  );
}

// ── Role card ─────────────────────────────────────────────────────────────────
function RoleCard({ r, propertyId, senderName, onRemove, ownerAuthed, onNeedAuth }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [errMsg, setErrMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [pinState, setPinState] = useState(null);

  const url = `${window.location.origin}/deal-room/${propertyId}?role=${r.role}`;

  async function tryGeneratePin() {
    if (!ownerAuthed) { onNeedAuth(doGeneratePin); return; }
    doGeneratePin();
  }

  async function doGeneratePin() {
    setPinState({ status: 'loading' });
    try {
      const pin = await generatePinForRole(propertyId, r.role);
      setPinState({ status: 'ready', pin });
    } catch (ex) {
      setPinState({ status: 'error', error: ex.message });
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { setErrMsg('Enter a valid email'); return; }
    setStatus('loading'); setErrMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: r.role, email: email.trim(), senderName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      setStatus('sent');
      tryGeneratePin();
    } catch (ex) { setErrMsg(ex.message); setStatus('error'); }
  }

  async function handleCopy() {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    if (!pinState) tryGeneratePin();
  }

  if (status === 'sent') return (
    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">{r.icon}</span>
        <p className="text-xs font-bold text-green-800 flex-1 min-w-0">{r.label}</p>
        <span className="text-[9px] font-bold text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5 shrink-0">✓ Invited</span>
      </div>
      <p className="text-[10px] text-green-600">Sent to <span className="font-semibold">{email}</span></p>
      {pinState && <PinReveal pin={pinState.pin} loading={pinState.status === 'loading'} error={pinState.status === 'error' ? pinState.error : null} onRegenerate={doGeneratePin} />}
      <button onClick={() => { setStatus('idle'); setEmail(''); setPinState(null); }} className="text-[9px] text-green-500 underline mt-1.5 block">Send to another →</button>
    </div>
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 group/card relative">
      {onRemove && (
        <button onClick={onRemove} title="Hide role" className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 text-gray-200 hover:text-red-400 transition text-xs leading-none">✕</button>
      )}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base">{r.icon}</span>
        <p className="text-xs font-semibold text-gray-800">{r.label}</p>
      </div>
      <form onSubmit={handleSend} className="space-y-1.5">
        <input type="email" placeholder={`${r.label.toLowerCase()}@firm.com`} value={email}
          onChange={e => { setEmail(e.target.value); setErrMsg(''); setStatus('idle'); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        {errMsg && <p className="text-[9px] text-red-500">{errMsg}</p>}
        <div className="flex items-center gap-1.5">
          <button type="submit" disabled={status === 'loading' || !email.trim()}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {status === 'loading' ? 'Sending…' : 'Send Invite →'}
          </button>
          <button type="button" onClick={handleCopy} title="Copy link"
            className="px-2 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition shrink-0">
            {copied ? '✓' : '🔗'}
          </button>
        </div>
      </form>
      {pinState && <PinReveal pin={pinState.pin} loading={pinState.status === 'loading'} error={pinState.status === 'error' ? pinState.error : null} onRegenerate={doGeneratePin} />}
    </div>
  );
}

// ── Custom party card ─────────────────────────────────────────────────────────
function CustomPartyCard({ propertyId, senderName, ownerAuthed, onNeedAuth }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [errMsg, setErrMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [pinState, setPinState] = useState(null);

  function getRoleKey() {
    return label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32) || 'guest';
  }
  function reset() { setOpen(false); setLabel(''); setEmail(''); setStatus('idle'); setErrMsg(''); setPinState(null); }

  async function tryGeneratePin(roleKey) {
    if (!ownerAuthed) { onNeedAuth(() => doGeneratePin(roleKey)); return; }
    doGeneratePin(roleKey);
  }

  async function doGeneratePin(roleKey) {
    setPinState({ status: 'loading' });
    try {
      const pin = await generatePinForRole(propertyId, roleKey);
      setPinState({ status: 'ready', pin });
    } catch (ex) { setPinState({ status: 'error', error: ex.message }); }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!label.trim()) { setErrMsg('Enter a role name'); return; }
    if (!email.trim() || !email.includes('@')) { setErrMsg('Enter a valid email'); return; }
    setStatus('loading'); setErrMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: getRoleKey(), email: email.trim(), senderName, customLabel: label.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      setStatus('sent');
      tryGeneratePin(getRoleKey());
    } catch (ex) { setErrMsg(ex.message); setStatus('error'); }
  }

  async function handleCopy() {
    const url = `${window.location.origin}/deal-room/${propertyId}?role=${getRoleKey()}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    if (!pinState) tryGeneratePin(getRoleKey());
  }

  if (status === 'sent') return (
    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">👤</span>
        <p className="text-xs font-bold text-green-800 flex-1 min-w-0">{label}</p>
        <span className="text-[9px] font-bold text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5 shrink-0">✓ Invited</span>
      </div>
      <p className="text-[10px] text-green-600">Sent to <span className="font-semibold">{email}</span></p>
      {pinState && <PinReveal pin={pinState.pin} loading={pinState.status === 'loading'} error={pinState.status === 'error' ? pinState.error : null} onRegenerate={() => doGeneratePin(getRoleKey())} />}
      <button onClick={reset} className="text-[9px] text-green-500 underline mt-1.5 block">Send to another →</button>
    </div>
  );

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 flex flex-col items-center justify-center gap-1 w-full hover:border-gray-300 hover:bg-gray-50 transition group" style={{ minHeight: 90 }}>
      <span className="text-lg text-gray-300 group-hover:text-gray-400 transition">+</span>
      <p className="text-[11px] font-medium text-gray-400 group-hover:text-gray-500">Invite someone else</p>
      <p className="text-[10px] text-gray-300 group-hover:text-gray-400">Custom role</p>
    </button>
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base">👤</span>
        <p className="text-xs font-semibold text-gray-700">Custom party</p>
        <button onClick={reset} className="ml-auto text-gray-300 hover:text-gray-500 text-xs transition">✕</button>
      </div>
      <form onSubmit={handleSend} className="space-y-1.5">
        <input autoFocus type="text" placeholder="Their role (e.g. IP Counsel)" value={label}
          onChange={e => { setLabel(e.target.value); setErrMsg(''); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        <input type="email" placeholder="email@firm.com" value={email}
          onChange={e => { setEmail(e.target.value); setErrMsg(''); }}
          className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        {errMsg && <p className="text-[9px] text-red-500">{errMsg}</p>}
        <div className="flex items-center gap-1.5">
          <button type="submit" disabled={status === 'loading' || !label.trim() || !email.trim()}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed">
            {status === 'loading' ? 'Sending…' : 'Send Invite →'}
          </button>
          <button type="button" onClick={handleCopy} title="Copy link"
            className="px-2 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition shrink-0">
            {copied ? '✓' : '🔗'}
          </button>
        </div>
      </form>
      {pinState && <PinReveal pin={pinState.pin} loading={pinState.status === 'loading'} error={pinState.status === 'error' ? pinState.error : null} onRegenerate={() => doGeneratePin(getRoleKey())} />}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export default function InvitePanel({ propertyId, senderName, packId = DEFAULT_PACK_ID }) {
  const allRoles = getInvitableRoles(packId);
  const [ownerAuthed, setOwnerAuthed] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingCallback, setPendingCallback] = useState(null);

  // Check if there's already an active Supabase Auth session
  useEffect(() => {
    getOwnerSession().then(s => { if (s) setOwnerAuthed(true); });
  }, []);

  function handleNeedAuth(callback) {
    setPendingCallback(() => callback);
    setShowAuthModal(true);
  }

  function handleAuthVerified() {
    setOwnerAuthed(true);
    setShowAuthModal(false);
    if (pendingCallback) {
      pendingCallback();
      setPendingCallback(null);
    }
  }

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
    <>
      {showAuthModal && (
        <OwnerAuthModal
          onVerified={handleAuthVerified}
          onDismiss={() => { setShowAuthModal(false); setPendingCallback(null); }}
        />
      )}

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
              ownerAuthed={ownerAuthed}
              onNeedAuth={handleNeedAuth}
            />
          ))}
          <CustomPartyCard
            propertyId={propertyId}
            senderName={senderName}
            ownerAuthed={ownerAuthed}
            onNeedAuth={handleNeedAuth}
          />
        </div>

        <p className="text-[10px] text-gray-400 mt-3 text-center">
          Each party sees only what's relevant to their role · 🔗 copies the link · PIN protects access
          {ownerAuthed && ' · ✓ Verified as owner'}
        </p>
      </div>
    </>
  );
}
