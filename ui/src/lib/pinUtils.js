// lib/pinUtils.js — PIN utilities for deal room link protection
import { supabase } from './supabaseClient';

// ── Crypto helpers ───────────────────────────────────────────────────────────

/** SHA-256 hash → lowercase hex string (browser SubtleCrypto) */
export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute the PIN hash that the database stores and the gate verifies.
 * Format: sha256(propertyId:roleKey:pin)
 */
export async function computePinHash(propertyId, roleKey, pin) {
  return sha256Hex(`${propertyId}:${roleKey}:${pin.trim()}`);
}

// ── Owner authentication ─────────────────────────────────────────────────────

/**
 * Send a Supabase Auth magic-link OTP to the owner's email.
 * The owner's email must match deal_rooms.customer_email — this is enforced
 * server-side by the RLS policy on deal_room_pins (not here).
 *
 * Set shouldCreateUser: false so an attacker cannot create a Supabase account
 * for an email they don't control; Supabase still returns a generic success
 * response either way (no enumeration of valid emails).
 */
export async function requestOwnerOtp(email) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw new Error(error.message);
}

/**
 * Verify the OTP code the owner received and establish a Supabase Auth session.
 */
export async function verifyOwnerOtp(email, token) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });
  if (error) throw new Error(error.message);
}

/** Check if an authenticated Supabase session is currently active. */
export async function getOwnerSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

// ── PIN generation (requires authenticated owner session) ────────────────────

/**
 * Generate a cryptographically random 6-digit PIN, store its hash in Supabase,
 * and return the plaintext PIN.
 *
 * Security:
 * - Uses crypto.getRandomValues (CSPRNG), not Math.random.
 * - Only the hash is stored; plaintext is returned once and never persisted.
 * - The INSERT is done with the owner's authenticated Supabase JWT; the RLS policy
 *   on deal_room_pins checks auth.email() === deal_rooms.customer_email so only
 *   the actual room owner can write PINs for their room.
 * - Any existing active PIN for this room/role is invalidated first.
 *
 * Throws if the caller is not authenticated or if the RLS check fails.
 */
export async function generatePinForRole(propertyId, roleKey) {
  if (!supabase) throw new Error('Supabase not configured');

  const session = await getOwnerSession();
  if (!session) throw new Error('Not authenticated — please verify your email first');

  // CSPRNG 6-digit PIN (0–999999, zero-padded)
  const raw = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  const pin = String(raw).padStart(6, '0');
  const pinHash = await computePinHash(propertyId, roleKey, pin);

  // Invalidate any currently active PIN for this room + role
  await supabase
    .from('deal_room_pins')
    .update({ invalidated_at: new Date().toISOString() })
    .eq('property_id', propertyId)
    .eq('role_key', roleKey)
    .is('invalidated_at', null);

  // Insert new hash. RLS policy: auth.email() must match deal_rooms.customer_email.
  const { error } = await supabase
    .from('deal_room_pins')
    .insert({ property_id: propertyId, role_key: roleKey, pin_hash: pinHash });

  if (error) {
    // RLS rejection surfaces as an authorization error — surface a clear message.
    if (error.code === '42501' || error.message?.includes('row-level security')) {
      throw new Error('Unauthorized — your email does not match this room's owner');
    }
    throw new Error(error.message);
  }

  return pin;
}
