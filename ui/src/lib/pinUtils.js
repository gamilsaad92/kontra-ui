/**
 * PIN utility functions for Kontra deal room PIN protection.
 * All PIN verification happens server-side via a SECURITY DEFINER RPC —
 * raw hashes never leave the database.
 */
import { supabase } from './supabaseClient';

// ── Crypto helpers ────────────────────────────────────────────────────────────

/** SHA-256 hash → lowercase hex string (Web Crypto API) */
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(text))
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Hash a raw PIN value */
export async function computePinHash(pin) {
  return sha256Hex(String(pin).trim());
}

// ── PIN existence check ───────────────────────────────────────────────────────

/**
 * Probe whether a PIN has been set for a given room+role.
 * Calls the RPC with a sentinel hash that will never match.
 *
 * Returns:
 *   true  — a PIN row exists (gate should show entry form)
 *   false — no PIN row exists (gate should show "contact owner" screen)
 *   null  — could not determine (RPC error or Supabase not configured)
 */
export async function checkPinExists(propertyId, roleKey) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('verify_deal_room_pin', {
      p_property_id: propertyId,
      p_role_key: roleKey,
      p_pin_hash: '__probe__',
    });
    if (error) return null;
    // RPC returns NULL when no pin row exists; TRUE/FALSE when one does
    return data !== null;
  } catch {
    return null;
  }
}

// ── PIN verification ──────────────────────────────────────────────────────────

/**
 * Verify a PIN entered by a participant.
 *
 * Returns:
 *   true  — correct PIN
 *   false — wrong PIN (a row exists but hash didn't match)
 *   null  — no PIN set, or RPC error
 */
export async function verifyDealRoomPin(propertyId, roleKey, pin) {
  if (!supabase) return null;
  try {
    const hash = await computePinHash(pin);
    const { data, error } = await supabase.rpc('verify_deal_room_pin', {
      p_property_id: propertyId,
      p_role_key: roleKey,
      p_pin_hash: hash,
    });
    if (error) return null;
    return data; // true / false / null
  } catch {
    return null;
  }
}

// ── Owner auth (OTP) ──────────────────────────────────────────────────────────

/** Send a magic-link / OTP to the owner's email via Supabase Auth */
export async function requestOwnerOtp(email) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

/** Verify an OTP token received by email. Returns the Supabase session. */
export async function verifyOwnerOtp(email, token) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;
  return data.session;
}

/** Return the current Supabase session, or null if not signed in */
export async function getOwnerSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

// ── PIN generation ────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random 6-digit PIN for a role, invalidate any
 * previous PIN for the same room+role, and store the hash in deal_room_pins.
 *
 * Requires an active Supabase Auth session scoped to the owner's email
 * (the RLS policy on deal_room_pins enforces this).
 *
 * Returns the plain-text PIN (shown once; never stored).
 */
export async function generatePinForRole(propertyId, roleKey) {
  if (!supabase) throw new Error('Supabase not configured');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated — verify your email first');

  // CSPRNG 6-digit PIN
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const pin = String(arr[0] % 1_000_000).padStart(6, '0');
  const pinHash = await computePinHash(pin);

  // Invalidate previous PINs for this role
  await supabase
    .from('deal_room_pins')
    .update({ invalidated_at: new Date().toISOString() })
    .eq('property_id', propertyId)
    .eq('role_key', roleKey)
    .is('invalidated_at', null);

  // Insert new PIN hash
  const { error } = await supabase.from('deal_room_pins').insert({
    property_id: propertyId,
    role_key: roleKey,
    pin_hash: pinHash,
  });
  if (error) throw new Error(error.message);

  return pin;
}
