'use strict';

const express = require('express');
const { z } = require('zod');
const { supabase: adminSupabase } = require('../db');
const requireMembershipRole = require('../middlewares/requireMembershipRole');

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITABLE_ROLES = new Set(['admin', 'member']);

function rolePortal(role) {
  return role === 'owner' || role === 'admin' ? 'lender' : 'lender';
}

function canInviteRole(actorRole, targetRole) {
  return INVITABLE_ROLES.has(targetRole) &&
    (actorRole === 'owner' || (actorRole === 'admin' && targetRole === 'member'));
}

function canAssignRole(actorRole, targetRole) {
  return actorRole === 'owner' && INVITABLE_ROLES.has(targetRole);
}

function serializeMembership(row) {
  const email = row.invited_email || row.user?.email || null;
  return {
    id: row.id,
    user_id: row.user_id,
    role: row.role,
    app_role: row.role,
    status: row.status,
    created_at: row.created_at,
    profiles: email ? { id: row.user_id, email, full_name: row.data?.full_name || null, avatar_url: null } : null,
  };
}

router.get('/me', (req, res) => {
  if (!req.authUserId || !req.membership) {
    return res.status(401).json({ code: 'AUTH_REQUIRED' });
  }
  const role = req.membershipRole;
  const email = req.user?.email || null;
  const fullName = req.user?.user_metadata?.full_name || null;
  return res.json({
    profile: { id: req.authUserId, email, full_name: fullName, avatar_url: null },
    app_role: role,
    role,
    org_id: req.orgId,
    portal: rolePortal(role),
  });
});

router.get('/members', requireMembershipRole('owner', 'admin'), async (req, res) => {
  const { data, error } = await adminSupabase
    .from('org_memberships')
    .select('id, org_id, user_id, role, status, invited_email, data, created_at, deleted_at')
    .eq('org_id', req.orgId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[onboarding] canonical membership list failed', error.code || 'query_error');
    return res.status(503).json({ code: 'ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE' });
  }
  const members = await Promise.all((data || []).map(async (row) => {
    if (row.invited_email) return serializeMembership(row);
    try {
      const { data: authUser } = await adminSupabase.auth.admin.getUserById(row.user_id);
      return serializeMembership({ ...row, user: authUser?.user || null });
    } catch {
      return serializeMembership(row);
    }
  }));
  return res.json({
    members,
    permissions: {
      canAssignRoles: req.membershipRole === 'owner',
      canInviteAdmin: req.membershipRole === 'owner',
      canRevokeMembers: true,
    },
  });
});

router.post('/invite', requireMembershipRole('owner', 'admin'), async (req, res) => {
  const parsed = z.object({
    email: z.string().trim().email().max(320),
    full_name: z.string().trim().max(120).optional(),
    app_role: z.enum(['admin', 'member']).optional(),
    role: z.enum(['admin', 'member']).optional(),
    org_id: z.string().uuid().optional(),
  }).safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ code: 'INVITE_INPUT_INVALID' });
  }
  const { email, full_name: fullName } = parsed.data;
  const targetRole = parsed.data.role || parsed.data.app_role || 'member';

  if (parsed.data.org_id && String(parsed.data.org_id) !== String(req.orgId)) {
    return res.status(403).json({ code: 'ORG_FORBIDDEN' });
  }
  if (!canInviteRole(req.membershipRole, targetRole)) {
    return res.status(403).json({ code: 'ORG_ROLE_FORBIDDEN' });
  }

  const normalizedEmail = email.toLowerCase();
  const { data: existingRows, error: lookupError } = await adminSupabase
    .from('org_memberships')
    .select('id, status')
    .eq('org_id', req.orgId)
    .eq('invited_email', normalizedEmail)
    .limit(1);
  if (lookupError) {
    console.error('[onboarding] invite membership lookup failed', lookupError.code || 'query_error');
    return res.status(503).json({ code: 'ORG_MEMBERSHIP_LOOKUP_UNAVAILABLE' });
  }
  if (existingRows?.length) {
    return res.status(409).json({ code: 'ORG_MEMBERSHIP_ALREADY_EXISTS' });
  }

  const { data: invitation, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
    normalizedEmail,
    { data: { full_name: fullName || null, org_id: req.orgId, org_role: targetRole } },
  );
  if (inviteError || !UUID_RE.test(String(invitation?.user?.id || ''))) {
    console.warn('[onboarding] Supabase Auth invitation failed', inviteError?.code || 'invalid_auth_user');
    return res.status(502).json({ code: 'INVITATION_DELIVERY_FAILED' });
  }

  const invitedUserId = invitation.user.id;
  const { data: membership, error: membershipError } = await adminSupabase
    .from('org_memberships')
    .insert({
      org_id: req.orgId,
      user_id: invitedUserId,
      role: targetRole,
      status: 'active',
      invited_email: normalizedEmail,
      created_by: req.authUserId,
      data: fullName ? { full_name: fullName } : {},
    })
    .select('id, org_id, user_id, role, status, invited_email, data, created_at')
    .single();
  if (membershipError) {
    // The Auth invitation may already have been delivered. The user remains
    // unable to access this organization unless the membership insert succeeds.
    console.error('[onboarding] invited user membership insert failed', membershipError.code || 'insert_error');
    return res.status(503).json({ code: 'ORG_MEMBERSHIP_CREATE_FAILED' });
  }

  return res.status(201).json({ member: serializeMembership(membership) });
});

router.post('/assign-role', requireMembershipRole('owner'), async (req, res) => {
  const parsed = z.object({
    user_id: z.string().regex(UUID_RE),
    app_role: z.enum(['admin', 'member']).optional(),
    role: z.enum(['admin', 'member']).optional(),
  }).safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ code: 'ROLE_ASSIGNMENT_INVALID' });

  const targetRole = parsed.data.role || parsed.data.app_role;
  const targetUserId = parsed.data.user_id;
  if (!targetRole || !canAssignRole(req.membershipRole, targetRole)) {
    return res.status(403).json({ code: 'ORG_ROLE_FORBIDDEN' });
  }
  if (String(targetUserId) === String(req.authUserId)) {
    return res.status(403).json({ code: 'SELF_ROLE_CHANGE_FORBIDDEN' });
  }

  const { data, error } = await adminSupabase
    .from('org_memberships')
    .update({ role: targetRole, updated_at: new Date().toISOString() })
    .eq('org_id', req.orgId)
    .eq('user_id', targetUserId)
    .eq('status', 'active')
    .neq('role', 'owner')
    .select('id, user_id, role, status, created_at')
    .maybeSingle();
  if (error) {
    console.error('[onboarding] membership role update failed', error.code || 'update_error');
    return res.status(503).json({ code: 'ORG_MEMBERSHIP_UPDATE_FAILED' });
  }
  if (!data) return res.status(404).json({ code: 'ORG_MEMBERSHIP_NOT_FOUND' });
  return res.json({ member: data });
});

router.post('/revoke', requireMembershipRole('owner', 'admin'), async (req, res) => {
  const parsed = z.object({ user_id: z.string().regex(UUID_RE) }).safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ code: 'MEMBERSHIP_REVOCATION_INVALID' });
  const targetUserId = parsed.data.user_id;
  if (String(targetUserId) === String(req.authUserId)) {
    return res.status(403).json({ code: 'SELF_REVOCATION_FORBIDDEN' });
  }

  let query = adminSupabase
    .from('org_memberships')
    .update({ status: 'revoked', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('org_id', req.orgId)
    .eq('user_id', targetUserId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .neq('role', 'owner');
  if (req.membershipRole === 'admin') query = query.eq('role', 'member');

  const { data, error } = await query
    .select('id, user_id, role, status, deleted_at')
    .maybeSingle();
  if (error) {
    console.error('[onboarding] membership revocation failed', error.code || 'update_error');
    return res.status(503).json({ code: 'ORG_MEMBERSHIP_UPDATE_FAILED' });
  }
  if (!data) return res.status(404).json({ code: 'ORG_MEMBERSHIP_NOT_FOUND' });
  return res.json({ member: data });
});

module.exports = router;
