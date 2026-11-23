/**
 * Invite utility functions for Kontra deal room per-invitation access control.
 *
 * Architecture:
 *   - Each participant has an independent invite record in deal_room_invites.
 *   - Verification (email OTP or PIN) produces a short-lived session token.
 *   - That token is passed as the x-kontra-session header on subsequent queries.
 *   - Supabase RLS policies call validate_session_for_property() server-side —
 *     no client-side flag can bypass the data layer.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// ── Session storage ───────────────────────────────────────────────────────────

const SESSION_KEY = (propertyId) => `kontra_session_${propertyId}`;
const OWNER_HINT_KEY = (propertyId) => `kontra_owner_token_${propertyId}`;
const OWNER_SESSION_HINT = 'room-owner-session';
const inviteSessionsInMemory = new Map();

// Remove reusable owner credentials left by earlier releases. Only a
// non-secret marker may remain in browser storage; authorization is cookie-only.
try {
  if (typeof localStorage !== 'undefined') {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith('kontra_owner_token_')) continue;
      if (localStorage.getItem(key) !== OWNER_SESSION_HINT) localStorage.removeItem(key);
    }
  }
} catch { /* storage unavailable */ }

export function setOwnerSessionHint(propertyId, enabled = true) {
  try {
    if (enabled) localStorage.setItem(OWNER_HINT_KEY(propertyId), OWNER_SESSION_HINT);
    else localStorage.removeItem(OWNER_HINT_KEY(propertyId));
  } catch { /* storage unavailable */ }
}

/** Persist a session token for the current tab lifetime. */
export function storeInviteSession(propertyId, sessionToken, expiresAt) {
  inviteSessionsInMemory.set(propertyId, { token: sessionToken, expires: expiresAt });
  try {
    sessionStorage.setItem(SESSION_KEY(propertyId), JSON.stringify({
      token: sessionToken,
      expires: expiresAt,
    }));
  } catch { /* storage unavailable */ }
}

/** Retrieve a stored session token. Returns null if absent or expired. */
export function getInviteSession(propertyId) {
  const inMemory = inviteSessionsInMemory.get(propertyId);
  if (inMemory) {
    if (inMemory.expires && new Date(inMemory.expires) < new Date()) {
      inviteSessionsInMemory.delete(propertyId);
    } else {
      return inMemory.token;
    }
  }
  try {
    const raw = sessionStorage.getItem(SESSION_KEY(propertyId));
    if (!raw) return null;
    const { token, expires } = JSON.parse(raw);
    if (expires && new Date(expires) < new Date()) {
      sessionStorage.removeItem(SESSION_KEY(propertyId));
      return null;
    }
    inviteSessionsInMemory.set(propertyId, { token, expires });
    return token;
  } catch {
    return null;
  }
}

/** Build server authorization headers for a room request. */
export function getRoomAuthHeaders(propertyId, extra = {}) {
  const headers = { ...extra };
  try {
    const sessionToken = getInviteSession(propertyId);
    if (sessionToken) {
      headers['x-kontra-session'] = sessionToken;
    }
  } catch { /* storage unavailable */ }
  return headers;
}

/** Clear a stored session (e.g. after revocation). */
export function clearInviteSession(propertyId) {
  inviteSessionsInMemory.delete(propertyId);
  try { sessionStorage.removeItem(SESSION_KEY(propertyId)); } catch { /* ignore */ }
}

export function buildInviteLink(
  propertyId,
  inviteToken,
  roleKey,
  origin = typeof window === 'undefined' ? '' : window.location.origin,
) {
  if (!propertyId || !inviteToken || !roleKey) return '';
  const url = new URL(`/deal-room/${encodeURIComponent(propertyId)}`, origin);
  url.searchParams.set('invite', inviteToken);
  url.searchParams.set('role', roleKey);
  return url.toString();
}

export function clearInviteCredentialsFromUrl({ verificationPath } = {}) {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('invite');
    url.searchParams.delete('participant_access');
    if (verificationPath) url.pathname = verificationPath;
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    return true;
  } catch {
    return false;
  }
}

// ── Session-aware Supabase client ─────────────────────────────────────────────

/**
 * Returns a Supabase client that injects the session token as x-kontra-session.
 * RLS policies read this header server-side via get_kontra_session_header().
 */
export function createSessionClient(sessionToken) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return supabase;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { 'x-kontra-session': sessionToken },
    },
  });
}

// ── Invite status ─────────────────────────────────────────────────────────────

/**
 * Fetch invite metadata for a given raw invite token.
 * Returns safe data only (no hashes).
 *
 * Result shape:
 *   { invite_exists, status, role_key, property_id, verification_method,
 *     invited_email_masked, locked_until, attempt_count }
 */
export async function getInviteStatus(inviteToken) {
  if (!supabase) return { invite_exists: false, error: 'not_configured' };
  try {
    const { data, error } = await supabase.rpc('get_invite_status', {
      p_invite_token: inviteToken,
    });
    if (error) return { invite_exists: false, error: error.message };
    return data || { invite_exists: false };
  } catch (e) {
    return { invite_exists: false, error: e.message };
  }
}

// ── Token-only (link-auth) invite verification ────────────────────────────────

/**
 * Verify an invite using only the URL token — no PIN required.
 * Works for invites created with verificationMethod='link'.
 *
 * Returns:
 *   { success: true, session_token, role_key, expires_at }
 *   { success: false, error, requires_pin?, locked_until? }
 */
export async function verifyInviteLink(propertyId, inviteToken) {
  const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
  try {
    const res = await fetch(`${API_BASE}/api/public/deal-room/${encodeURIComponent(propertyId)}/invite/verify-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteToken }),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || `Server error ${res.status}`, requires_pin: data.error === 'requires_pin', locked_until: data.locked_until };
    return { success: true, ...data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/** Exchange a signed notification CTA for the normal participant session. */
export async function verifyParticipantAccess(propertyId, accessToken) {
  const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
  try {
    const res = await fetch(`${API_BASE}/api/public/deal-room/${encodeURIComponent(propertyId)}/participant-access/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || `Server error ${res.status}` };
    return { success: true, ...data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── PIN verification ──────────────────────────────────────────────────────────

/**
 * Verify a PIN for an invite.
 * Server hashes the PIN; the raw value is never stored.
 *
 * Returns:
 *   { success: true, session_token, role_key, property_id, expires_at }
 *   { success: false, error, attempts_remaining?, locked_until? }
 */
export async function verifyInvitePin(inviteToken, pin) {
  if (!supabase) return { success: false, error: 'not_configured' };
  try {
    const { data, error } = await supabase.rpc('verify_invite_credential', {
      p_invite_token: inviteToken,
      p_credential: String(pin).trim(),
    });
    if (error) return { success: false, error: error.message };
    return data || { success: false, error: 'no_response' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Email OTP (Supabase Auth → session) ──────────────────────────────────────

/**
 * Send a Supabase Auth OTP to the invited email.
 * shouldCreateUser=false so only pre-existing Supabase users receive the OTP;
 * for new participants, Supabase Auth is configured to allow signups.
 */
export async function sendInviteOtp(email) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

/**
 * Verify the OTP code, then exchange for an invite session token.
 * Returns { success, session_token, role_key, property_id, expires_at }.
 */
export async function verifyInviteOtp(email, otp, inviteToken) {
  if (!supabase) return { success: false, error: 'not_configured' };
  try {
    const { error: otpErr } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });
    if (otpErr) return { success: false, error: otpErr.message };

    // Auth OTP verified → create invite session
    const { data, error } = await supabase.rpc('create_invite_session_for_email', {
      p_invite_token: inviteToken,
    });
    if (error) return { success: false, error: error.message };
    return data || { success: false, error: 'no_response' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Owner: create invite ──────────────────────────────────────────────────────

/** Generate a cryptographically random URL token. */
export function generateInviteToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Generate a cryptographically random 6-digit PIN. */
export function generatePin() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, '0');
}

/**
 * Create an invite record for a participant (owner must be authenticated).
 * Returns { success, error? }.
 */
export async function createInvite({
  propertyId,
  roleKey,
  invitedEmail,
  verificationMethod = 'pin',
  pin,
}) {
  const token = generateInviteToken();
  const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
  try {
    const res = await fetch(`${API_BASE}/api/public/deal-room/${encodeURIComponent(propertyId)}/create-invite`, {
      method: 'POST',
      headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ roleKey, invitedEmail, inviteToken: token, pin, verificationMethod }),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || `Server error ${res.status}` };
    return {
      success: true,
      invite_token: token,
      emailSent: data.emailSent === true,
      deliveryReason: data.deliveryReason || null,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Owner: manage invites ─────────────────────────────────────────────────────

/** Fetch all invite records for a room (owner only). */
export async function getRoomInvites(propertyId) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('get_room_invites', {
      p_property_id: propertyId,
    });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Revoke a single invite (owner only). */
export async function revokeInvite(propertyId, inviteId) {
  if (!propertyId || !inviteId) return { success: false, error: 'invalid_request' };
  try {
    const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
    const res = await fetch(
      `${API_BASE}/api/public/deal-room/${encodeURIComponent(propertyId)}/invites/${encodeURIComponent(inviteId)}/revoke`,
      {
        method: 'POST',
        headers: getRoomAuthHeaders(propertyId, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        credentials: 'include',
      },
    );
    const data = await res.json();
    if (!res.ok || data.ok !== true) {
      return { success: false, error: data.error || `Server error ${res.status}`, inviteRevoked: data.inviteRevoked === true };
    }
    return {
      success: true,
      sessionsRevoked: Number(data.sessionsRevoked) || 0,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/** Touch the session to update last_used_at (call on deal room load). */
export async function touchSession(sessionToken) {
  if (!supabase || !sessionToken) return;
  try {
    await supabase.rpc('touch_session', { p_session_token: sessionToken });
  } catch { /* non-critical */ }
}

// ── Owner auth (kept for owner OTP flows) ─────────────────────────────────────

export async function requestOwnerOtp(email) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function verifyOwnerOtp(email, token) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  return data.session;
}

export async function getOwnerSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}
