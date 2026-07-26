/**
 * InviteGate — participant verification screen.
 *
 * Reads the invite token from the URL (?invite=TOKEN). If no token is present
 * the visitor sees "Invitation Required". If a token is present, the component
 * calls get_invite_status() and branches to email-OTP or PIN verification.
 *
 * On success: calls onUnlocked(sessionToken) — the raw session token that
 * the parent stores and passes as x-kontra-session on Supabase queries.
 */
import { useState, useEffect } from 'react';
import {
  getInviteStatus,
  verifyInvitePin,
  sendInviteOtp,
  verifyInviteOtp,
  storeInviteSession,
  touchSession,
} from '../../lib/inviteUtils';

// ── Sub-screens ───────────────────────────────────────────────────────────────

function Spinner({ label = 'Loading…' }) {
  return (
    <div className="text-center py-4">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-[#800020] rounded-full animate-spin mx-auto mb-3" />
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function StaticScreen({ icon, title, body, children }) {
  return (
    <div className="text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
      {children}
    </div>
  );
}

function NoTokenScreen() {
  return (
    <>
      <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">🔐</span>
      </div>
      <h2 className="text-base font-bold text-gray-900 mb-2 text-center">Invitation Required</h2>
      <p className="text-xs text-gray-500 leading-relaxed mb-5 text-center max-w-[220px] mx-auto">
        This deal room requires a personal invitation link. Contact the deal owner to receive access.
      </p>
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <p className="text-[11px] font-semibold text-amber-700 text-center">Access is by invitation only</p>
        <p className="text-[10px] text-amber-500 mt-0.5 text-center">Each participant receives a unique, secure link</p>
      </div>
    </>
  );
}

function LockedScreen({ lockedUntil }) {
  const until = lockedUntil
    ? new Date(lockedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'shortly';
  return (
    <StaticScreen
      icon="🔒"
      title="Too many attempts"
      body={`Access is temporarily locked until ${until} after too many incorrect attempts. Please try again later.`}
    />
  );
}

function EmailEntryScreen({ inviteInfo, email, setEmail, errMsg, setErrMsg, working, onSubmit }) {
  return (
    <div>
      <div className="w-12 h-12 rounded-full bg-[#800020]/10 border border-[#800020]/20 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">✉️</span>
      </div>
      <h2 className="text-base font-bold text-gray-900 mb-1 text-center">Verify your invitation</h2>
      <p className="text-xs text-gray-500 text-center mb-5 leading-relaxed">
        {inviteInfo?.invited_email_masked
          ? <>Enter the email this invite was sent to ({inviteInfo.invited_email_masked}) to receive a one-time code.</>
          : <>Enter your email address to receive a verification code.</>}
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          autoFocus type="email" placeholder="your@email.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setErrMsg(''); }}
          className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        {errMsg && <p className="text-xs text-red-500">{errMsg}</p>}
        <button type="submit" disabled={working || !email.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
          {working ? 'Sending…' : 'Send verification code →'}
        </button>
      </form>
    </div>
  );
}

function OtpScreen({ email, otp, setOtp, errMsg, setErrMsg, working, onSubmit, onBack }) {
  return (
    <div>
      <div className="w-12 h-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">📬</span>
      </div>
      <h2 className="text-base font-bold text-gray-900 mb-1 text-center">Check your email</h2>
      <p className="text-xs text-gray-500 text-center mb-1">We sent a 6-digit code to</p>
      <p className="text-xs font-semibold text-gray-800 text-center mb-5 break-all">{email}</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          autoFocus type="text" inputMode="numeric"
          placeholder="000000" maxLength={6}
          value={otp}
          onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrMsg(''); }}
          className="w-full text-center text-2xl font-mono tracking-[0.5em] px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        {errMsg && <p className="text-xs text-red-500 text-center">{errMsg}</p>}
        <button type="submit" disabled={working || otp.length < 6}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
          {working ? 'Verifying…' : 'Verify code →'}
        </button>
        <button type="button" onClick={onBack}
          className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition">
          ← Use a different email
        </button>
      </form>
    </div>
  );
}

function PinScreen({ inviteInfo, pin, setPin, errMsg, setErrMsg, working, attemptsLeft, onSubmit }) {
  return (
    <div>
      <div className="w-12 h-12 rounded-full bg-[#800020]/10 border border-[#800020]/20 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">🔑</span>
      </div>
      <h2 className="text-base font-bold text-gray-900 mb-1 text-center">Enter your access PIN</h2>
      <p className="text-xs text-gray-500 text-center mb-5 leading-relaxed">
        Your 6-digit PIN was provided by the deal owner when your invitation was created.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          autoFocus type="text" inputMode="numeric"
          placeholder="000000" maxLength={6}
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrMsg(''); }}
          className="w-full text-center text-2xl font-mono tracking-[0.5em] px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        {errMsg && <p className="text-xs text-red-500 text-center">{errMsg}</p>}
        {attemptsLeft != null && attemptsLeft <= 2 && (
          <p className="text-[10px] text-amber-600 text-center">
            ⚠ {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining before temporary lockout
          </p>
        )}
        <button type="submit" disabled={working || pin.length < 6}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40">
          {working ? 'Verifying…' : 'Enter deal room →'}
        </button>
      </form>
    </div>
  );
}

// ── Main gate ─────────────────────────────────────────────────────────────────

export default function DealRoomPinGate({ propertyId, role, inviteToken, onUnlocked }) {
  // phases: loading | no_token | not_found | expired | revoked | locked |
  //         email_entry | otp_sent | pin_entry | unlocking | error
  const [phase, setPhase]           = useState(inviteToken ? 'loading' : 'no_token');
  const [inviteInfo, setInviteInfo] = useState(null);
  const [email, setEmail]           = useState('');
  const [otp, setOtp]               = useState('');
  const [pin, setPin]               = useState('');
  const [errMsg, setErrMsg]         = useState('');
  const [working, setWorking]       = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [lockedUntil, setLockedUntil]   = useState(null);

  // Fetch invite metadata on mount
  useEffect(() => {
    if (!inviteToken) return;
    getInviteStatus(inviteToken).then(info => {
      setInviteInfo(info);
      if (!info.invite_exists) { setPhase('not_found'); return; }
      if (info.status === 'revoked')  { setPhase('revoked');  return; }
      if (info.status === 'expired')  { setPhase('expired');  return; }
      if (info.locked_until && new Date(info.locked_until) > new Date()) {
        setLockedUntil(info.locked_until);
        setPhase('locked');
        return;
      }
      setPhase(info.verification_method === 'email_otp' ? 'email_entry' : 'pin_entry');
    }).catch(() => setPhase('error'));
  }, [inviteToken]);

  function handleSuccess(result) {
    storeInviteSession(propertyId, result.session_token, result.expires_at);
    touchSession(result.session_token).catch(() => {}); // non-critical
    onUnlocked(result.session_token);
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) { setErrMsg('Enter a valid email address'); return; }
    setWorking(true); setErrMsg('');
    try {
      await sendInviteOtp(email.trim());
      setPhase('otp_sent');
    } catch (ex) {
      setErrMsg(ex.message || 'Could not send code — please try again');
    } finally {
      setWorking(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (otp.length < 6) { setErrMsg('Enter the 6-digit code'); return; }
    setWorking(true); setErrMsg(''); setPhase('unlocking');
    const result = await verifyInviteOtp(email.trim(), otp.trim(), inviteToken);
    setWorking(false);
    if (result.success) {
      handleSuccess(result);
    } else {
      setPhase('otp_sent');
      setErrMsg(
        result.error === 'email_mismatch'
          ? "This email doesn't match the invited address. Use the email this invitation was sent to."
          : result.error === 'expired'
          ? 'Invitation has expired. Contact the deal owner for a new link.'
          : 'Invalid code — check your email and try again.'
      );
    }
  }

  async function handleVerifyPin(e) {
    e.preventDefault();
    if (pin.length < 6) { setErrMsg('Enter your 6-digit PIN'); return; }
    setWorking(true); setErrMsg(''); setPhase('unlocking');
    const result = await verifyInvitePin(inviteToken, pin.trim());
    setWorking(false);
    if (result.success) {
      handleSuccess(result);
    } else {
      if (result.error === 'locked') {
        setLockedUntil(result.locked_until);
        setPhase('locked');
      } else {
        setPhase('pin_entry');
        setPin('');
        setAttemptsLeft(result.attempts_remaining ?? null);
        setErrMsg(
          result.error === 'wrong_credential'
            ? `Incorrect PIN${result.attempts_remaining != null ? ` — ${result.attempts_remaining} attempt${result.attempts_remaining !== 1 ? 's' : ''} remaining` : ''}`
            : result.error === 'expired'  ? 'Invitation has expired. Contact the deal owner.'
            : result.error === 'revoked'  ? 'This invitation has been revoked by the deal owner.'
            : 'Verification failed — please try again.'
        );
      }
    }
  }

  // ── Layout shell ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#800020] flex items-center justify-center">
              <span className="text-white text-sm font-bold select-none">K</span>
            </div>
            <span className="text-lg font-bold text-gray-900">Kontra</span>
          </div>
          <p className="text-[11px] text-gray-400">Secure Deal Room</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
          {phase === 'loading'   && <Spinner />}
          {phase === 'unlocking' && <Spinner label="Verifying…" />}
          {phase === 'no_token'  && <NoTokenScreen />}
          {phase === 'not_found' && (
            <StaticScreen icon="🔍" title="Invitation not found"
              body="This link may be invalid or has already been used. Contact the deal owner for a new invitation." />
          )}
          {phase === 'expired' && (
            <StaticScreen icon="⏰" title="Invitation expired"
              body="This invitation link has expired. Contact the deal owner to request a new one." />
          )}
          {phase === 'revoked' && (
            <StaticScreen icon="🚫" title="Access revoked"
              body="This invitation has been revoked by the deal owner. Contact them to discuss regaining access." />
          )}
          {phase === 'locked'  && <LockedScreen lockedUntil={lockedUntil} />}
          {phase === 'error'   && (
            <StaticScreen icon="⚠️" title="Something went wrong"
              body="We couldn't verify your invitation. Please refresh and try again." />
          )}
          {phase === 'email_entry' && (
            <EmailEntryScreen
              inviteInfo={inviteInfo}
              email={email} setEmail={setEmail}
              errMsg={errMsg} setErrMsg={setErrMsg}
              working={working} onSubmit={handleSendOtp}
            />
          )}
          {phase === 'otp_sent' && (
            <OtpScreen
              email={email} otp={otp} setOtp={setOtp}
              errMsg={errMsg} setErrMsg={setErrMsg}
              working={working} onSubmit={handleVerifyOtp}
              onBack={() => { setPhase('email_entry'); setOtp(''); setErrMsg(''); }}
            />
          )}
          {phase === 'pin_entry' && (
            <PinScreen
              inviteInfo={inviteInfo}
              pin={pin} setPin={setPin}
              errMsg={errMsg} setErrMsg={setErrMsg}
              working={working} attemptsLeft={attemptsLeft}
              onSubmit={handleVerifyPin}
            />
          )}
        </div>

        <p className="text-center text-[10px] text-gray-300 mt-5">
          Powered by Kontra · Confidential deal room
        </p>
      </div>
    </div>
  );
}
