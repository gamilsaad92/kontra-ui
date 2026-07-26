/**
 * DealRoomPinGate — full-screen gate rendered before deal room content.
 *
 * Behavior:
 *   • Probes verify_deal_room_pin RPC on mount with a sentinel hash.
 *   • RPC returns null  → no PIN set yet  → "Access Pending" screen (contact owner)
 *   • RPC returns false → PIN exists      → PIN entry form
 *   • 5 wrong attempts  → 15-min lockout stored in localStorage
 *   • Correct PIN       → session stored in sessionStorage → children render
 */
import { useState, useEffect, useCallback } from 'react';
import { checkPinExists, verifyDealRoomPin } from '../../lib/pinUtils';

const sessionKey  = (p, r) => `kontra_pin_${p}_${r}`;
const lockoutKey  = (p, r) => `kontra_lockout_${p}_${r}`;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000;

export default function DealRoomPinGate({ propertyId, roleKey, children }) {
  // phase: 'checking' | 'no-pin' | 'entry' | 'locked-out' | 'unlocked'
  const [phase,       setPhase]       = useState('checking');
  const [pin,         setPin]         = useState('');
  const [attempts,    setAttempts]    = useState(0);
  const [error,       setError]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState(null);

  useEffect(() => {
    // Already unlocked this session?
    if (sessionStorage.getItem(sessionKey(propertyId, roleKey)) === 'unlocked') {
      setPhase('unlocked');
      return;
    }

    // Active lockout?
    const raw = localStorage.getItem(lockoutKey(propertyId, roleKey));
    if (raw) {
      try {
        const { until, attempts: a } = JSON.parse(raw);
        if (Date.now() < until) {
          setLockoutUntil(until);
          setAttempts(a);
          setPhase('locked-out');
          return;
        }
        localStorage.removeItem(lockoutKey(propertyId, roleKey));
      } catch { /* ignore corrupt data */ }
    }

    // Probe RPC: does a PIN exist?
    checkPinExists(propertyId, roleKey).then(exists => {
      if (exists === null) {
        // Could not reach DB — fail closed: show entry form (user can try)
        setPhase('entry');
      } else if (exists === false) {
        // No PIN set yet
        setPhase('no-pin');
      } else {
        // PIN exists — show entry form
        setPhase('entry');
      }
    });
  }, [propertyId, roleKey]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (pin.length !== 6 || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await verifyDealRoomPin(propertyId, roleKey, pin);
      if (result === true) {
        sessionStorage.setItem(sessionKey(propertyId, roleKey), 'unlocked');
        setPhase('unlocked');
      } else {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_MS;
          localStorage.setItem(lockoutKey(propertyId, roleKey), JSON.stringify({ until, attempts: next }));
          setLockoutUntil(until);
          setPhase('locked-out');
        } else {
          setError(`Incorrect PIN. ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? '' : 's'} remaining.`);
          setPin('');
        }
      }
    } catch {
      setError('Unable to verify — please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [pin, submitting, attempts, propertyId, roleKey]);

  function handlePinInput(val) {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    setPin(digits);
    if (error) setError('');
    if (digits.length === 6) {
      // slight delay so the last digit renders before we grey out the field
      setTimeout(() => handleSubmit(), 30);
    }
  }

  if (phase === 'unlocked') return <>{children}</>;

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

          {/* ── Checking ── */}
          {phase === 'checking' && (
            <div className="flex justify-center py-6">
              <div className="w-7 h-7 border-2 border-[#800020]/20 border-t-[#800020] rounded-full animate-spin" />
            </div>
          )}

          {/* ── No PIN set ── */}
          {phase === 'no-pin' && (
            <>
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🔒</span>
                </div>
                <h2 className="text-base font-bold text-gray-900 mb-1">Access Pending</h2>
                <p className="text-xs text-gray-500 leading-relaxed max-w-[220px] mx-auto">
                  The owner hasn't enabled PIN protection for this link yet.
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-center space-y-0.5">
                <p className="text-[11px] font-semibold text-amber-700">Contact the owner to get access</p>
                <p className="text-[10px] text-amber-500">They'll generate a PIN from their deal room</p>
              </div>
            </>
          )}

          {/* ── PIN entry ── */}
          {phase === 'entry' && (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-[#800020]/5 border border-[#800020]/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🔑</span>
                </div>
                <h2 className="text-base font-bold text-gray-900 mb-1">Enter your PIN</h2>
                <p className="text-xs text-gray-500 leading-relaxed max-w-[220px] mx-auto">
                  This link is protected. Enter the 6-digit PIN provided by the deal owner.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={e => handlePinInput(e.target.value)}
                  placeholder="• • • • • •"
                  disabled={submitting}
                  className="w-full text-center text-2xl font-bold tracking-[0.5em] px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-200 disabled:opacity-50 transition"
                />
                {error && (
                  <p className="text-[11px] text-red-500 text-center">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={pin.length !== 6 || submitting}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Verifying…' : 'Enter Deal Room →'}
                </button>
              </form>
            </>
          )}

          {/* ── Locked out ── */}
          {phase === 'locked-out' && (
            <>
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🚫</span>
                </div>
                <h2 className="text-base font-bold text-gray-900 mb-1">Too many attempts</h2>
                <p className="text-xs text-gray-500 leading-relaxed max-w-[220px] mx-auto">
                  Access is temporarily locked. Contact the deal owner if you need help.
                </p>
              </div>
              {lockoutUntil && (
                <LockoutTimer
                  until={lockoutUntil}
                  onExpire={() => {
                    localStorage.removeItem(lockoutKey(propertyId, roleKey));
                    setAttempts(0);
                    setPin('');
                    setPhase('entry');
                  }}
                />
              )}
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-gray-300 mt-5">
          Powered by Kontra · Confidential deal room
        </p>
      </div>
    </div>
  );
}

// ── Countdown timer shown during lockout ──────────────────────────────────────
function LockoutTimer({ until, onExpire }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, until - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, until - Date.now());
      setRemaining(r);
      if (r === 0) { clearInterval(id); onExpire(); }
    }, 1_000);
    return () => clearInterval(id);
  }, [until, onExpire]);

  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1_000);

  return (
    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
      <p className="text-[11px] font-semibold text-red-600">
        Try again in {mins}:{String(secs).padStart(2, '0')}
      </p>
    </div>
  );
}
