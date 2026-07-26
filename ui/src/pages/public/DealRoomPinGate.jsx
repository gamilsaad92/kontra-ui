/**
 * DealRoomPinGate — participant PIN verification screen.
 *
 * Flow:
 *   1. Reads ?invite=TOKEN from URL.
 *   2. Calls get_invite_status() to validate the invite.
 *   3. Participant enters the PIN given to them by the deal owner (out-of-band).
 *   4. On success → calls onUnlocked(sessionToken).
 *
 * The invite email from Kontra contains the link only — no PIN.
 * The owner shares the PIN separately (phone, text, in person).
 */
import { useState, useEffect } from 'react';
import { getInviteStatus, verifyInvitePin, storeInviteSession, touchSession } from '../../lib/inviteUtils';

function Spinner({ label = 'Loading…' }) {
  return (
    <div className="text-center py-4">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-[#800020] rounded-full animate-spin mx-auto mb-3" />
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function StaticScreen({ icon, title, body }) {
  return (
    <div className="text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <h2 className="text-base font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
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
      body={`Access is temporarily locked until ${until} after too many incorrect PIN attempts. Please try again later.`}
    />
  );
}

function PinScreen({ pin, setPin, errMsg, setErrMsg, working, attemptsLeft, onSubmit }) {
  return (
    <div>
      <div className="w-12 h-12 rounded-full bg-[#800020]/10 border border-[#800020]/20 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">🔑</span>
      </div>
      <h2 className="text-base font-bold text-gray-900 mb-1 text-center">Enter your access PIN</h2>
      <p className="text-xs text-gray-500 text-center mb-1 leading-relaxed">
        Enter the 6-digit PIN the deal owner gave you.
      </p>
      <p className="text-[10px] text-gray-400 text-center mb-5">
        Didn't receive a PIN? Contact the deal owner directly.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          placeholder="000000"
          maxLength={6}
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrMsg(''); }}
          className="w-full text-center text-2xl font-mono tracking-[0.5em] px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
        />
        {errMsg && <p className="text-xs text-red-500 text-center">{errMsg}</p>}
        {attemptsLeft != null && attemptsLeft <= 2 && (
          <p className="text-[10px] text-amber-600 text-center">
            ⚠ {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining before lockout
          </p>
        )}
        <button
          type="submit"
          disabled={working || pin.length < 6}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40"
        >
          {working ? 'Verifying…' : 'Enter deal room →'}
        </button>
      </form>
    </div>
  );
}

export default function DealRoomPinGate({ propertyId, role, inviteToken, onUnlocked }) {
  // phases: loading | no_token | not_found | expired | revoked | locked | pin_entry | unlocking | error
  const [phase, setPhase]               = useState(inviteToken ? 'loading' : 'no_token');
  const [pin, setPin]                   = useState('');
  const [errMsg, setErrMsg]             = useState('');
  const [working, setWorking]           = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [lockedUntil, setLockedUntil]   = useState(null);

  useEffect(() => {
    if (!inviteToken) return;
    getInviteStatus(inviteToken).then(info => {
      if (!info.invite_exists)                                       { setPhase('not_found'); return; }
      if (info.status === 'revoked')                                 { setPhase('revoked');   return; }
      if (info.status === 'expired')                                 { setPhase('expired');   return; }
      if (info.locked_until && new Date(info.locked_until) > new Date()) {
        setLockedUntil(info.locked_until);
        setPhase('locked');
        return;
      }
      setPhase('pin_entry');
    }).catch(() => setPhase('error'));
  }, [inviteToken]);

  async function handleVerifyPin(e) {
    e.preventDefault();
    if (pin.length < 6) { setErrMsg('Enter your 6-digit PIN'); return; }
    setWorking(true); setErrMsg(''); setPhase('unlocking');
    const result = await verifyInvitePin(inviteToken, pin.trim());
    setWorking(false);
    if (result.success) {
      storeInviteSession(propertyId, result.session_token, result.expires_at);
      touchSession(result.session_token).catch(() => {});
      onUnlocked(result.session_token);
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
            : result.error === 'expired' ? 'Invitation has expired. Contact the deal owner.'
            : result.error === 'revoked' ? 'This invitation has been revoked by the deal owner.'
            : 'Verification failed — please try again.'
        );
      }
    }
  }

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
          {phase === 'locked' && <LockedScreen lockedUntil={lockedUntil} />}
          {phase === 'error' && (
            <StaticScreen icon="⚠️" title="Something went wrong"
              body="We couldn't verify your invitation. Please refresh and try again." />
          )}
          {phase === 'pin_entry' && (
            <PinScreen
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
