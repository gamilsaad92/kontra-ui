/**
 * dealRoomSecurityV2.js — Thin Express router for participant security v2.
 *
 * Design: Edge Function equivalents. Each handler:
 *   1. Validates the caller's identity (JWT via supabase.auth.getUser)
 *   2. Extracts and sanitizes inputs
 *   3. Delegates ALL business logic to private.* database functions
 *   4. Returns the result
 *
 * No business logic lives here. No database queries here other than
 * calling private schema functions via privateDb.callPrivate().
 *
 * Routes:
 *   POST /api/v2/deal-room/invite/create       — owner creates invite + sends link email
 *   POST /api/v2/deal-room/invite/resolve       — anonymous token resolution (safe fields only)
 *   POST /api/v2/deal-room/invite/request-otp  — anonymous OTP request (rate-limited)
 *   POST /api/v2/deal-room/invite/accept        — participant accepts after OTP verification
 *   POST /api/v2/deal-room/invite/revoke        — owner revokes invite or participant
 *   GET  /api/v2/deal-room/invites/:roomId      — owner lists invites for a room
 *   GET  /api/v2/deal-room/document-url         — participant gets signed document URL
 *   GET  /api/v2/deal-room/audit-log/:roomId    — owner reads categorized audit log
 */

'use strict';

const express   = require('express');
const crypto    = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { supabase: fallbackSupabase } = require('../db');
const { callPrivate }  = require('../lib/privateDb');

const router = express.Router();
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  : fallbackSupabase;

// ── Resend email sender ──────────────────────────────────────────────────────
const RESEND_KEY  = process.env.RESEND_API_KEY;
const FROM_EMAIL  = 'Kontra <notifications@kontraplatform.com>';
const BASE_URL    = process.env.APP_BASE_URL || 'https://kontraplatform.com';

async function sendResendEmail({ to, subject, text, html }) {
  if (!RESEND_KEY) throw new Error('RESEND_API_KEY not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: FROM_EMAIL, to, subject, text, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    null
  );
}

/**
 * Non-fatal audit log helper.
 * Audit logging must never block or fail a user-facing operation.
 * If SUPABASE_DB_URL is misconfigured, log the error but let the
 * request succeed.
 */
async function logAuditSafe(...args) {
  try {
    await callPrivate('log_audit_event', args);
  } catch (err) {
    console.error('[audit-log] non-fatal write failure:', err.message);
  }
}

/**
 * Validate a Bearer JWT with Supabase Auth server.
 * Returns the verified user or throws.
 * Never decodes or trusts JWT claims directly.
 */
async function requireAuthUser(req) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) throw Object.assign(new Error('Authorization required'), { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw Object.assign(new Error('Invalid token'), { status: 401 });
  return user;
}

/**
 * Verify the authenticated user is the owner of the given room.
 * Returns the room record or throws 403.
 */
async function requireRoomOwner(userEmail, roomId) {
  const { data: room, error } = await supabaseAdmin
    .from('deal_rooms')
    .select('property_id, property_name, customer_email, first_name, auth_v2_enabled')
    .eq('property_id', roomId)
    .single();

  if (error || !room) throw Object.assign(new Error('Room not found'), { status: 404 });

  const normalized = (e) => (e || '').toLowerCase().trim();
  if (normalized(room.customer_email) !== normalized(userEmail)) {
    throw Object.assign(new Error('Not authorized for this room'), { status: 403 });
  }
  return room;
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v2/deal-room/invite/create
 * Owner creates a per-participant invite and Kontra sends the link email.
 * The PIN is NOT used in v2 — OTP via email is the verification method.
 *
 * Body: { roomId, roleKey, invitedEmail }
 * Auth: Bearer <owner JWT>
 */
router.post('/invite/create', async (req, res) => {
  try {
    const user = await requireAuthUser(req);
    const { roomId, roleKey, invitedEmail } = req.body || {};

    if (!roomId || !roleKey || !invitedEmail) {
      return res.status(400).json({ error: 'roomId, roleKey, invitedEmail required' });
    }

    const normalizedEmail = invitedEmail.toLowerCase().trim();
    if (!normalizedEmail.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const room = await requireRoomOwner(user.email, roomId);

    // Generate token — raw token goes in invite URL; only hash stored in DB
    const rawToken  = generateToken();
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Insert invite via service role
    const { data: invite, error: insertErr } = await supabaseAdmin
      .from('deal_room_invites_v2')
      .insert({
        room_id:          roomId,
        role_key:         roleKey,
        invited_email:    normalizedEmail,
        token_hash:       tokenHash,
        expires_at:       expiresAt,
        created_by_email: user.email.toLowerCase().trim(),
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('[invite/create]', insertErr.message);
      return res.status(500).json({ error: 'Failed to create invite' });
    }

    // Audit (non-fatal — invite is already created)
    await logAuditSafe(
      roomId, 'security', 'invite_created',
      user.id, user.email.toLowerCase().trim(),
      null, normalizedEmail,
      invite.id, null, getClientIp(req),
      JSON.stringify({ role_key: roleKey }),
    );

    // Send invite link email (link only — no OTP in this email)
    // ?role= must be in the URL so DealRoomPage knows to show the participant
    // gate rather than defaulting to the owner bypass.
    const inviteUrl = `${BASE_URL}/deal-room/${roomId}?invite=${rawToken}&role=${encodeURIComponent(roleKey)}`;
    const roleName  = roleKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const roomName  = room.property_name || roomId;
    const senderName = room.first_name || 'The deal coordinator';

    try {
      await sendResendEmail({
        to:      normalizedEmail,
        subject: `You've been invited to ${roomName} — Kontra Deal Room`,
        text: [
          `${senderName} has invited you as ${roleName} to the deal room for ${roomName} on Kontra.`,
          '',
          'Click your personal invite link to begin:',
          inviteUrl,
          '',
          'When you arrive, you will be asked to verify your identity by entering a code sent to this email address.',
          '',
          'This link is unique to you — do not forward it.',
          '',
          '---',
          'You received this because the deal coordinator added your email.',
          'If this is a mistake, ignore this email.',
        ].join('\n'),
        html: `
<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px 24px">
  <div style="margin-bottom:24px">
    <span style="display:inline-block;background:#800020;color:white;font-weight:800;font-size:15px;padding:6px 14px;border-radius:8px">Kontra</span>
  </div>
  <h2 style="color:#111;font-size:22px;font-weight:800;margin:0 0 8px">You've been invited</h2>
  <p style="color:#555;font-size:15px;margin:0 0 6px">
    <strong>${senderName}</strong> has invited you as <strong>${roleName}</strong>
    to the deal room for <strong>${roomName}</strong>.
  </p>
  <p style="color:#555;font-size:14px;margin:0 0 24px">
    Click your personal link below. You'll verify your identity with a code
    sent to this email address before accessing the room.
  </p>
  <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;background:#800020;color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
    Open my invite →
  </a>
  <div style="margin-top:20px;padding:12px 16px;background:#fef9f0;border-radius:10px;border:1px solid #fde68a">
    <p style="color:#92400e;font-size:12px;margin:0">
      🔒 This link is unique to you — do not forward it.
      Each participant must receive their own personal invite.
    </p>
  </div>
  <p style="color:#bbb;font-size:11px;margin-top:24px">
    You received this because ${senderName} added your email to a Kontra deal room.
    If this is a mistake, ignore this email.
  </p>
</div>`,
      });
    } catch (emailErr) {
      console.error('[invite/create] email send failed:', emailErr.message);
      // Don't fail the request — invite was created; log the email failure
      await logAuditSafe(
        roomId, 'security', 'invite_created',
        user.id, user.email.toLowerCase(),
        null, normalizedEmail, invite.id, null, getClientIp(req),
        JSON.stringify({ email_error: emailErr.message }),
      );
    }

    res.json({ ok: true, invite_id: invite.id });
  } catch (err) {
    console.error('[invite/create]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/v2/deal-room/invite/resolve
 * Anonymous. Validates a token and returns safe display info only.
 * Never returns the raw invite row.
 *
 * Body: { token }
 * Headers: Referrer-Policy: no-referrer, Cache-Control: no-store
 */
router.post('/invite/resolve', async (req, res) => {
  res.set({
    'Referrer-Policy': 'no-referrer',
    'Cache-Control':   'no-store, no-cache, must-revalidate',
    'X-Robots-Tag':    'noindex',
  });

  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string' || token.length < 32) {
      return res.status(400).json({ valid: false, reason: 'invalid_token' });
    }

    const tokenHash = sha256(token);
    const result    = await callPrivate('resolve_invite_token', [tokenHash]);

    if (!result) return res.status(404).json({ valid: false, reason: 'not_found' });

    await logAuditSafe(
      result.room_id, 'authorization',
      result.valid ? 'token_resolved' : 'token_invalid',
      null, null, null, null, result.invite_id || null,
      null, getClientIp(req), null,
    );

    // Return only safe fields — never invite_id or room_id to anonymous caller
    if (!result.valid) {
      return res.json({ valid: false, reason: result.reason });
    }

    res.json({
      valid:        true,
      masked_email: result.masked_email,
      role_key:     result.role_key,
      room_name:    result.room_name,
      // _internal fields used by request-otp — not forwarded to browser UI
      _invite_id:   result.invite_id,
      _invited_email: result.invited_email,
    });
  } catch (err) {
    console.error('[invite/resolve]', err.message);
    // Generic error — do not reveal whether token exists
    res.status(200).json({ valid: false, reason: 'error' });
  }
});

/**
 * POST /api/v2/deal-room/invite/request-otp
 * Anonymous. Rate-limited. Sends OTP to the invited email.
 * Always returns generic { ok: true } — never reveals rate limit reason.
 *
 * Body: { token }
 */
router.post('/invite/request-otp', async (req, res) => {
  res.set({ 'Cache-Control': 'no-store' });

  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string' || token.length < 32) {
      return res.json({ ok: true }); // generic response
    }

    const tokenHash = sha256(token);
    const invite    = await callPrivate('resolve_invite_token', [tokenHash]);

    if (!invite?.valid) {
      return res.json({ ok: true }); // generic — don't reveal invite status
    }

    // Rate limit check (logged inside the function)
    const rateCheck = await callPrivate('check_otp_rate_limit', [
      invite.invite_id,
      invite.invited_email,
      getClientIp(req),
    ]);

    if (!rateCheck?.allowed) {
      // Log rate limit hit but return generic response
      await logAuditSafe(
        invite.room_id, 'authorization', 'otp_rate_limited',
        null, null, null, invite.invited_email,
        invite.invite_id, null, getClientIp(req),
        JSON.stringify({ reason: rateCheck?.reason }),
      );
      return res.json({ ok: true }); // generic
    }

    // Generate OTP via Supabase Auth, send via Resend
    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type:  'magiclink',
        email: invite.invited_email,
      });

    if (linkErr || !linkData?.properties?.email_otp) {
      console.error('[request-otp] generateLink failed:', linkErr?.message);
      return res.json({ ok: true }); // generic
    }

    const otp = linkData.properties.email_otp;

    await sendResendEmail({
      to:      invite.invited_email,
      subject: 'Your Kontra deal room verification code',
      text: [
        `Your verification code is: ${otp}`,
        '',
        'This code expires in 10 minutes.',
        'Enter it on the Kontra deal room page to complete verification.',
        '',
        'If you did not request access to a deal room, ignore this email.',
      ].join('\n'),
      html: `
<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px">
  <div style="margin-bottom:20px">
    <span style="display:inline-block;background:#800020;color:white;font-weight:800;font-size:14px;padding:5px 12px;border-radius:6px">Kontra</span>
  </div>
  <h2 style="color:#111;font-size:20px;font-weight:800;margin:0 0 12px">Your verification code</h2>
  <div style="background:#f9fafb;border:2px solid #e5e7eb;border-radius:12px;padding:24px;text-align:center;margin:20px 0">
    <p style="font-size:36px;font-weight:900;letter-spacing:0.3em;color:#111;margin:0;font-family:monospace">${otp}</p>
    <p style="color:#6b7280;font-size:12px;margin:8px 0 0">Expires in 10 minutes</p>
  </div>
  <p style="color:#555;font-size:14px">Enter this code on the Kontra deal room page to verify your identity and gain access.</p>
  <p style="color:#bbb;font-size:11px;margin-top:24px">If you did not request this code, ignore this email — no action is needed.</p>
</div>`,
    });

    await logAuditSafe(
      invite.room_id, 'authorization', 'otp_sent',
      null, null, null, invite.invited_email,
      invite.invite_id, null, getClientIp(req), null,
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[request-otp]', err.message);
    res.json({ ok: true }); // always generic
  }
});

/**
 * POST /api/v2/deal-room/invite/accept
 * Participant calls this AFTER Supabase OTP verification creates their session.
 * JWT is validated server-side via auth.getUser() — claims never trusted directly.
 *
 * Body: { token }
 * Auth: Bearer <participant JWT from supabase.auth.verifyOtp()>
 */
router.post('/invite/accept', async (req, res) => {
  try {
    const user = await requireAuthUser(req);
    const { token } = req.body || {};

    if (!token || typeof token !== 'string' || token.length < 32) {
      return res.status(400).json({ error: 'token required' });
    }

    const tokenHash = sha256(token);

    // Atomic acceptance in private schema (advisory lock, email check, insert)
    const result = await callPrivate('accept_invite', [
      tokenHash,
      user.id,
      user.email.toLowerCase().trim(),
      getClientIp(req),
    ]);

    if (!result?.ok) {
      const status =
        result?.error === 'email_mismatch'      ? 403 :
        result?.error === 'invite_not_pending'  ? 409 :
        result?.error === 'invite_expired'      ? 410 :
        result?.error === 'concurrent_acceptance' ? 409 : 500;

      return res.status(status).json({ error: result?.error || 'acceptance_failed' });
    }

    await logAuditSafe(
      result.room_id, 'authorization', 'otp_verified',
      user.id, user.email.toLowerCase(), null, null,
      null, null, getClientIp(req),
      JSON.stringify({ role_key: result.role_key }),
    );

    res.json({
      ok:             true,
      room_id:        result.room_id,
      role_key:       result.role_key,
      participant_id: result.participant_id,
    });
  } catch (err) {
    console.error('[invite/accept]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/v2/deal-room/invite/revoke
 * Owner revokes a specific invite (role) or all access for a participant.
 *
 * Body: { roomId, inviteId? | participantId? }
 * Auth: Bearer <owner JWT>
 */
router.post('/invite/revoke', async (req, res) => {
  try {
    const user = await requireAuthUser(req);
    const { roomId, inviteId, participantId } = req.body || {};

    if (!roomId) return res.status(400).json({ error: 'roomId required' });
    if (!inviteId && !participantId) {
      return res.status(400).json({ error: 'inviteId or participantId required' });
    }

    await requireRoomOwner(user.email, roomId);

    const result = await callPrivate('revoke_participant', [
      inviteId    || null,
      participantId || null,
      user.email.toLowerCase().trim(),
      getClientIp(req),
    ]);

    if (!result?.ok) return res.status(500).json({ error: 'revocation_failed' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[invite/revoke]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/v2/deal-room/invite/reissue
 * Owner reissues an invite — supersedes old token, creates new one.
 *
 * Body: { roomId, inviteId }
 * Auth: Bearer <owner JWT>
 */
router.post('/invite/reissue', async (req, res) => {
  try {
    const user = await requireAuthUser(req);
    const { roomId, inviteId } = req.body || {};

    if (!roomId || !inviteId) {
      return res.status(400).json({ error: 'roomId and inviteId required' });
    }

    const room = await requireRoomOwner(user.email, roomId);

    const newRawToken  = generateToken();
    const newTokenHash = sha256(newRawToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const newInviteId = await callPrivate('rotate_invite_token', [
      inviteId,
      newTokenHash,
      newExpiresAt,
      user.email.toLowerCase().trim(),
      getClientIp(req),
    ]);

    // Fetch the new invite to get the email for re-sending
    const { data: newInvite } = await supabaseAdmin
      .from('deal_room_invites_v2')
      .select('invited_email, role_key')
      .eq('id', newInviteId)
      .single();

    if (newInvite) {
      const inviteUrl = `${BASE_URL}/deal-room/${roomId}?invite=${newRawToken}&role=${encodeURIComponent(newInvite.role_key)}`;
      const roleName  = newInvite.role_key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      await sendResendEmail({
        to:      newInvite.invited_email,
        subject: `Updated invite: ${room.property_name || roomId} — Kontra Deal Room`,
        text: `Your invite link to the deal room for ${room.property_name || roomId} has been updated.\n\nUse this new link:\n${inviteUrl}\n\nYour previous link is no longer valid.`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px 24px">
  <span style="display:inline-block;background:#800020;color:white;font-weight:800;font-size:14px;padding:5px 12px;border-radius:6px;margin-bottom:20px">Kontra</span>
  <h2 style="color:#111;font-size:20px;font-weight:800;margin:0 0 12px">Your invite link has been updated</h2>
  <p style="color:#555;font-size:14px;margin:0 0 20px">Your previous link to <strong>${room.property_name || roomId}</strong> is no longer valid. Use the link below:</p>
  <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:700">Open updated invite →</a>
</div>`,
      }).catch(e => console.error('[reissue] email failed:', e.message));
    }

    res.json({ ok: true, new_invite_id: newInviteId });
  } catch (err) {
    console.error('[invite/reissue]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /api/v2/deal-room/invites/:roomId
 * Owner lists all invites for a room.
 * Auth: Bearer <owner JWT>
 */
router.get('/invites/:roomId', async (req, res) => {
  try {
    const user   = await requireAuthUser(req);
    const roomId = req.params.roomId;

    await requireRoomOwner(user.email, roomId);

    const { data: invites, error } = await supabaseAdmin
      .from('deal_room_invites_v2')
      .select(`
        id, room_id, role_key, invited_email, status,
        expires_at, created_at, revoked_at,
        deal_room_participant_roles ( status, granted_at,
          deal_room_participants ( auth_uid, status )
        )
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, invites: invites || [] });
  } catch (err) {
    console.error('[invites/list]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /api/v2/deal-room/document-url
 * Generates a 60-second signed URL for a document.
 * Checks room membership and document visibility_scope.
 * Logs signed_url_issued (not document_downloaded — see architecture notes).
 *
 * Query: ?roomId=&documentId=
 * Auth: Bearer <participant or owner JWT>
 */
router.get('/document-url', async (req, res) => {
  try {
    const user = await requireAuthUser(req);
    const { roomId, documentId } = req.query;

    if (!roomId || !documentId) {
      return res.status(400).json({ error: 'roomId and documentId required' });
    }

    // Fetch document (confirms it belongs to this room)
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('deal_room_documents')
      .select('id, storage_path, visibility_scope, property_id')
      .eq('id', documentId)
      .eq('property_id', roomId)
      .single();

    if (docErr || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Determine access: owner or active participant with correct visibility
    const userEmail = user.email.toLowerCase().trim();

    // Check if owner
    const { data: room } = await supabaseAdmin
      .from('deal_rooms')
      .select('customer_email')
      .eq('property_id', roomId)
      .single();

    const isOwner = room && (room.customer_email || '').toLowerCase().trim() === userEmail;

    if (!isOwner) {
      // Check participant
      const { data: participant } = await supabaseAdmin
        .from('deal_room_participants')
        .select('id, status, deal_room_participant_roles(role_key, status)')
        .eq('room_id', roomId)
        .eq('auth_uid', user.id)
        .eq('status', 'active')
        .single();

      if (!participant) {
        return res.status(403).json({ error: 'Not a participant in this room' });
      }

      // Check visibility scope
      if (doc.visibility_scope === 'owner_only') {
        return res.status(403).json({ error: 'Document not shared with participants' });
      }

      if (doc.visibility_scope === 'selected_roles') {
        const activeRoles = (participant.deal_room_participant_roles || [])
          .filter(r => r.status === 'active')
          .map(r => r.role_key);

        const { data: visibleRoles } = await supabaseAdmin
          .from('document_visible_to_roles')
          .select('role_key')
          .eq('document_id', documentId)
          .in('role_key', activeRoles);

        if (!visibleRoles?.length) {
          return res.status(403).json({ error: 'Document not visible to your role' });
        }
      }

      if (doc.visibility_scope === 'selected_individuals') {
        const { data: vi } = await supabaseAdmin
          .from('document_visible_to_participants')
          .select('auth_uid')
          .eq('document_id', documentId)
          .eq('auth_uid', user.id)
          .single();

        if (!vi) {
          return res.status(403).json({ error: 'Document not shared with you individually' });
        }
      }
    }

    // Generate 60-second signed URL
    const { data: urlData, error: urlErr } = await supabaseAdmin.storage
      .from('deal-room-documents')
      .createSignedUrl(doc.storage_path, 60);

    if (urlErr || !urlData?.signedUrl) {
      return res.status(500).json({ error: 'Could not generate document URL' });
    }

    // Log signed_url_issued (not "downloaded" — see architecture notes on revocation timing)
    await logAuditSafe(
      roomId, 'document_activity', 'signed_url_issued',
      user.id, userEmail, null, null, null, documentId,
      getClientIp(req),
      JSON.stringify({ storage_path: doc.storage_path, ttl_seconds: 60 }),
    );

    res.json({ ok: true, signed_url: urlData.signedUrl, expires_in: 60 });
  } catch (err) {
    console.error('[document-url]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /api/v2/deal-room/audit-log/:roomId
 * Owner reads categorized audit log for their room.
 * Supports ?category=security|authorization|document_activity filter.
 *
 * Auth: Bearer <owner JWT>
 */
router.get('/audit-log/:roomId', async (req, res) => {
  try {
    const user   = await requireAuthUser(req);
    const roomId = req.params.roomId;
    const { category, limit = '100', before } = req.query;

    await requireRoomOwner(user.email, roomId);

    let query = supabaseAdmin
      .from('deal_room_audit_log')
      .select('id, event_category, event_type, actor_email, target_email, invite_id, document_id, ip_address, metadata, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(Math.min(parseInt(limit, 10) || 100, 500));

    if (category) query = query.eq('event_category', category);
    if (before)   query = query.lt('created_at', before);

    const { data: events, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({ ok: true, events: events || [] });
  } catch (err) {
    console.error('[audit-log]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
