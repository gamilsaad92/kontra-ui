// lib/pinUtils.js — shared PIN utilities
import { API_BASE } from './apiBase';

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

/** Hash format: sha256(propertyId:roleKey:pin) — used client-side for verification */
export async function computePinHash(propertyId, roleKey, pin) {
  return sha256Hex(`${propertyId}:${roleKey}:${pin.trim()}`);
}

/**
 * Ask the API server to generate and store a PIN for a room/role.
 * Requires the room's link_token for ownership validation (server-side).
 * Returns the plaintext PIN string, or throws on failure.
 *
 * Security: PIN hash is written only by the API server using the Supabase
 * service role key — the client never writes to deal_room_pins directly.
 */
export async function storePinForRole(propertyId, roleKey, linkToken) {
  if (!linkToken) throw new Error('Room token required to generate a PIN');

  const base = (API_BASE || '').replace(/\/+$/, '');
  const res = await fetch(`${base}/api/public/deal-room/${encodeURIComponent(propertyId)}/generate-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role_key: roleKey, link_token: linkToken }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Server error ${res.status}`);
  if (!json.pin) throw new Error('No PIN returned by server');
  return json.pin;
}
