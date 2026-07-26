// DealRoomPinGate.jsx — shown to non-owner participants before deal room loads
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { sha256Hex, computePinHash } from '../../lib/pinUtils';

const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 min

function lockoutKey(propertyId, role) {
  return `kontra_pin_lockout_${propertyId}_${role}`;
}

function sessionKey(propertyId, role) {
  return `kontra_pin_ok_${propertyId}_${role}`;
}

export default function DealRoomPinGate({ propertyId, role, onUnlocked }) {
  // 'checking' | 'gate' | 'locked' | 'open'
  const [state, setState] = useState('checking');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);

  const sKey = sessionKey(propertyId, role);
  const lKey = lockoutKey(propertyId, role);

  const markUnlocked = useCallback(() => {
    try { sessionStorage.setItem(sKey, '1'); } catch {}
    onUnlocked();
  }, [sKey, onUnlocked]);

  useEffect(() => {
    async function check() {
      // 1. Already verified this browser session?
      try {
        if (sessionStorage.getItem(sKey)) { onUnlocked(); return; }
      } catch {}

      // 2. Locked out?
      try {
        const lo = JSON.parse(localStorage.getItem(lKey) || 'null');
        if (lo && Date.now() < lo.until) {
          setState('locked');
          return;
        } else if (lo) {
          localStorage.removeItem(lKey);
        }
      } catch {}

      // 3. Does a PIN exist for this room/role?
      //    Send a dummy hash — RPC returns null if no PIN set (open access), false if PIN exists.
      if (!supabase) { onUnlocked(); return; }
      try {
        const dummyHash = await sha256Hex('__probe__');
        const { data, error: rpcErr } = await supabase.rpc('verify_deal_room_pin', {
          p_property_id: propertyId,
          p_role_key:    role,
          p_pin_hash:    dummyHash,
        });
        if (rpcErr) { onUnlocked(); return; } // RPC not yet deployed → open
        if (data === null) { onUnlocked(); return; } // No PIN set → legacy link
        // PIN exists → show entry gate
        try {
          const attempts = parseInt(localStorage.getItem(lKey + '_attempts') || '0', 10);
          setAttemptsLeft(Math.max(0, MAX_ATTEMPTS - attempts));
        } catch { setAttemptsLeft(MAX_ATTEMPTS); }
        setState('gate');
      } catch {
        onUnlocked(); // Network failure → open rather than block
      }
    }
    check();
  }, [propertyId, role, sKey, lKey, onUnlocked]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (pin.trim().length < 4 || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const hash = await computePinHash(propertyId, role, pin.trim());
      const { data } = await supabase.rpc('verify_deal_room_pin', {
        p_property_id: propertyId,
        p_role_key:    role,
        p_pin_hash:    hash,
      });
      if (data === true) {
        // Correct PIN — clear lockout tracking and unlock
        try { localStorage.removeItem(lKey + '_attempts'); } catch {}
        markUnlocked();
      } else {
        // Wrong PIN — track attempts
        let attempts = 0;
        try { attempts = parseInt(localStorage.getItem(lKey + '_attempts') || '0', 10) + 1; } catch {}
        try { localStorage.setItem(lKey + '_attempts', String(attempts)); } catch {}
        const left = Math.max(0, MAX_ATTEMPTS - attempts);
        setAttemptsLeft(left);
        if (left <= 0) {
          try { localStorage.setItem(lKey, JSON.stringify({ until: Date.now() + LOCKOUT_DURATION_MS })); } catch {}
          try { localStorage.removeItem(lKey + '_attempts'); } catch {}
          setState('locked');
        } else {
          setError(`Incorrect PIN — ${left} attempt${left === 1 ? '' : 's'} remaining`);
          setPin('');
        }
      }
    } catch {
      setError('Unable to verify — please try again');
    }
    setSubmitting(false);
  }

  // ── Checking (brief spinner) ─────────────────────────────────────────────
  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Locked out ───────────────────────────────────────────────────────────
  if (state === 'locked') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-2xl mx-auto mb-5">🔒</div>
          <h1 className="text-base font-bold text-gray-900 mb-2">Access locked</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Too many incorrect attempts. Ask the deal owner to confirm the correct PIN, or try again in 15 minutes.
          </p>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">Powered by <span className="font-semibold text-gray-600">Kontra</span></p>
          </div>
        </div>
      </div>
    );
  }

  // ── PIN entry gate ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-sm p-8">

        {/* Brand mark */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-[#800020] flex items-center justify-center">
            <span className="text-white font-black text-sm">K</span>
          </div>
          <span className="font-bold text-gray-900 text-sm">Kontra</span>
        </div>

        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-2xl mb-5">🔑</div>
        <h1 className="text-lg font-bold text-gray-900 mb-1">Enter access PIN</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          This deal room is PIN-protected. The owner sent the PIN separately from this link — check for a text or second email.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="——————"
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
            autoFocus
            className="w-full text-center text-2xl font-bold tracking-[0.4em] px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020]/50 transition placeholder:tracking-widest placeholder:text-gray-300 placeholder:text-xl"
          />

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-600 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pin.length < 4 || submitting}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-[#800020] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Verifying…' : 'Access Deal Room →'}
          </button>
        </form>

        {attemptsLeft < MAX_ATTEMPTS && attemptsLeft > 0 && (
          <p className="text-[11px] text-gray-400 text-center mt-3">
            {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} remaining before lockout
          </p>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Don't have the PIN? Contact the person who sent you this link.
          </p>
        </div>
      </div>
    </div>
  );
}
