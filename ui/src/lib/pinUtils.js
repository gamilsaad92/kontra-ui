// lib/pinUtils.js — shared PIN generation & storage helpers
import { supabase } from './supabaseClient';

/** SHA-256 hash → hex string (browser SubtleCrypto) */
export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Generate a cryptographically random 6-digit PIN string */
export function generatePin() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1000000).padStart(6, '0');
}

/** Hash format: sha256(propertyId:roleKey:pin) */
export async function computePinHash(propertyId, roleKey, pin) {
  return sha256Hex(`${propertyId}:${roleKey}:${pin.trim()}`);
}

/**
 * Generate a new PIN for a room/role, invalidate any existing one, and store
 * the hash in Supabase. Returns the plaintext PIN so the owner can display it.
 */
export async function storePinForRole(propertyId, roleKey) {
  if (!supabase) throw new Error('Supabase not configured');

  const pin = generatePin();
  const hash = await computePinHash(propertyId, roleKey, pin);

  // Invalidate any existing active PIN for this room + role
  await supabase
    .from('deal_room_pins')
    .update({ invalidated_at: new Date().toISOString() })
    .eq('property_id', propertyId)
    .eq('role_key', roleKey)
    .is('invalidated_at', null);

  // Insert new PIN hash
  const { error } = await supabase
    .from('deal_room_pins')
    .insert({ property_id: propertyId, role_key: roleKey, pin_hash: hash });

  if (error) throw error;
  return pin;
}
