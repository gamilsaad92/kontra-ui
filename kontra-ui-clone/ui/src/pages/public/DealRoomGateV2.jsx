/**
 * DealRoomGateV2.jsx — Participant verification gate (security v2).
 *
 * Flow:
 *   1. Reads ?invite=TOKEN from URL (server resolves, URL replaced immediately)
 *   2. POST /api/v2/deal-room/invite/resolve  → safe display info
 *   3. Participant clicks "Send me a code"
 *   4. POST /api/v2/deal-room/invite/request-otp  → OTP sent to invited email
 *   5. Participant enters OTP
 *   6. supabase.auth.verifyOtp()  → Supabase session created
 *   7. POST /api/v2/deal-room/invite/accept  → participant record created (atomic)
 *   8. onVerified(session, roleKey, roomId) called
 *
 * Security:
 *   - URL token replaced immediately after resolve (step 2)
 *   - Referrer-Policy: no-referrer on resolve endpoint
 *   - No third-party scripts loaded on this screen
 *   - JWT validated server-side via auth.getUser() — never trust-decoded
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

async function apiPost(path, body, authToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  return res.json();
}

// ── Sub-screens ───────────────────────────────────────────────────────────────

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
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
          {children}
        </div>
        <p className="text-center text-[10px] text-gray-300 mt-5">
          Powered by Kontra · Confidential deal room
        </p>
      </div>
    </div>
  );
}

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

// ── Main component ────────────────────────────────────────────────────────────

export default function DealRoomGateV2({ roomId, inviteToken, onVerified }) {
  // Phases: resolving | invalid | request_otp | sending_otp | enter_otp
  //         verifying_otp | accepting | error
  const [phase,       setPhase]       = useState('resolving');
  const [inviteInfo,  setInviteInfo]  = useState(null);  // { masked_email, role_key, room_name }
  const [_rawToken,   setRawToken]    = useState(inviteToken);
  const [otpValue,    setOtpValue]    = useState('');
  const [otpEmail,    setOtpEmail]    = useState('');   // full email from resolve (for verifyOtp)
  const [errMsg,      setErrMsg]      = useState('');

  // Step 1+2: Resolve invite token, then immediately replace URL
  useEffect(() => {
    if (!inviteToken) { setPhase('invalid'); return; }

    apiPost('/api/v2/deal-room/invite/resolve', { token: inviteToken })
      .then(data => {
        if (!data.valid) {
          setPhase('invalid');
          return;
        }
        // Store full email for OTP verification (needed by supabase.auth.verifyOtp)
        setOtpEmail(data._invited_email || '');
        setInviteInfo({
          masked_email: data.masked_email,
          role_key:     data.role_key,
          room_name:    data.room_name,
        });
        // Replace URL immediately — remove token from browser history and Referer
        window.history.replaceState({}, '', `/deal-room/${roomId}/verify`);
        setRawToken(inviteToken); // keep in state (not URL) for subsequent calls
        setPhase('request_otp');
      })
      .catch(() => setPhase('error'));
  }, [inviteToken, roomId]);

  // Step 3: Request OTP
  async function handleRequestOtp() {
    setPhase('sending_otp');
    setErrMsg('');
    await apiPost('/api/v2/deal-room/invite/request-otp', { token: _rawToken });
    // Always advance — endpoint always returns { ok: true } for security
    setPhase('enter_otp');
  }

  // Steps 5-7: Verify OTP → create session → accept invite
  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (otpValue.length < 6) { setErrMsg('Enter the 6-digit code'); return; }
    setPhase('verifying_otp');
    setErrMsg('');

    try {
      // Step 5-6: Supabase verifies OTP and creates authenticated session
      const { data: authData, error: authErr } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otpValue.trim(),
        type:  'email',
      });

      if (authErr || !authData?.session) {
        setPhase('enter_otp');
        setOtpValue('');
        setErrMsg('Incorrect code or code expired. Request a new one.');
        return;
      }

      const session     = authData.session;
      const accessToken = session.access_token;

      // Step 7: Accept invite (atomic — server validates email match, creates participant)
      setPhase('accepting');
      const acceptResult = await apiPost(
        '/api/v2/deal-room/invite/accept',
        { token: _rawToken },
        accessToken
      );

      if (!acceptResult.ok) {
        setPhase('enter_otp');
        setOtpValue('');
        setErrMsg(
          acceptResult.error === 'email_mismatch'
            ? 'Email verification failed. Contact the deal coordinator.'
          : acceptResult.error === 'invite_expired'
            ? 'This invite has expired. Contact the deal coordinator for a new one.'
          : acceptResult.error === 'invite_not_pending'
            ? 'This invite has already been used or revoked.'
          : 'Verification failed. Please try again.'
        );
        return;
      }

      onVerified(session, acceptResult.role_key, acceptResult.room_id);
    } catch (err) {
      console.error('[DealRoomGateV2]', err);
      setPhase('enter_otp');
      setOtpValue('');
      setErrMsg('Something went wrong. Please try again.');
    }
  }

  return (
    <Shell>
      {phase === 'resolving'     && <Spinner />}
      {phase === 'sending_otp'   && <Spinner label="Sending code…" />}
      {phase === 'verifying_otp' && <Spinner label="Verifying…" />}
      {phase === 'accepting'     && <Spinner label="Setting up access…" />}

      {phase === 'invalid' && (
        <StaticScreen
          icon="🔍"
          title="Invitation not found"
          body="This link may be invalid, expired, or already used. Contact the deal coordinator for a new invitation."
        />
      )}

      {phase === 'error' && (
        <StaticScreen
          icon="⚠️"
          title="Something went wrong"
          body="We couldn't load your invitation. Please refresh the page or contact the deal coordinator."
        />
      )}

      {phase === 'request_otp' && inviteInfo && (
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[#800020]/10 border border-[#800020]/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔐</span>
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-1">
            You've been invited
          </h2>
          <p className="text-xs text-gray-500 mb-1">
            to <strong>{inviteInfo.room_name}</strong>
            {inviteInfo.role_key && ` as ${inviteInfo.role_key.replace(/_/g, ' ')}`}
          </p>
          <p className="text-[11px] text-gray-400 mb-6">
            We'll send a verification code to{' '}
            <span className="font-mono font-semibold text-gray-700">{inviteInfo.masked_email}</span>
          </p>
          <button
            onClick={handleRequestOtp}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#800020] hover:opacity-90 transition"
          >
            Send verification code →
          </button>
          <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
            Can't access that email? Contact the deal coordinator to update your invitation.
          </p>
        </div>
      )}

      {phase === 'enter_otp' && inviteInfo && (
        <div>
          <div className="w-12 h-12 rounded-full bg-[#800020]/10 border border-[#800020]/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✉️</span>
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-1 text-center">
            Check your email
          </h2>
          <p className="text-xs text-gray-500 text-center mb-1">
            Code sent to{' '}
            <span className="font-mono font-semibold text-gray-700">{inviteInfo.masked_email}</span>
          </p>
          <p className="text-[10px] text-gray-400 text-center mb-5">
            Check your spam folder if you don't see it within a minute.
          </p>
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              value={otpValue}
              onChange={e => {
                setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6));
                setErrMsg('');
              }}
              className="w-full text-center text-2xl font-mono tracking-[0.5em] px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/40 placeholder-gray-300"
            />
            {errMsg && <p className="text-xs text-red-500 text-center">{errMsg}</p>}
            <button
              type="submit"
              disabled={otpValue.length < 6}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40"
            >
              Verify →
            </button>
            <button
              type="button"
              onClick={() => { setOtpValue(''); setErrMsg(''); setPhase('request_otp'); }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition py-1"
            >
              ← Resend code
            </button>
          </form>
        </div>
      )}
    </Shell>
  );
}
