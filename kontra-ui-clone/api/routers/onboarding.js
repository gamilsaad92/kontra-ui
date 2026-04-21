/**
 * Onboarding Router — server-side user provisioning
 *
 * All onboarding writes use the Supabase SERVICE ROLE key (never the anon key)
 * so they can bypass RLS. The backend enforces that only lender admins or
 * platform admins can onboard other users.
 *
 * Endpoints:
 *   POST /api/onboarding/invite        — create auth user + profile + org membership
 *   POST /api/onboarding/assign-role   — update a user's app_role in org_members
 *   GET  /api/onboarding/members       — list org members with roles
 *   GET  /api/onboarding/me            — current user's profile + role
 */

const express = require('express');

const router = express.Router();

// Service-role client — NEVER expose to frontend
const { supabase: adminSupabase } = require('../db');

// ── Role permission sets ───────────────────────────────────────
const LENDER_ROLES = ['platform_admin', 'lender_admin', 'servicer', 'asset_manager'];
const VALID_APP_ROLES = ['platform_admin', 'lender_admin', 'servicer', 'asset_manager', 'investor', 'borrower'];

function requireLenderRole(req, res, next) {
  if (!LENDER_ROLES.includes(req.role)) {
    return res.status(403).json({ error: 'Forbidden: lender role required' });
  }
  next();
}

// Maps legacy role names (org_memberships.role) → new app_role values
const LEGACY_ROLE_MAP = {
  admin:         'lender_admin',
  lender_admin:  'lender_admin',
  platform_admin:'platform_admin',
  servicer:      'servicer',
  asset_manager: 'asset_manager',
  investor:      'investor',
  borrower:      'borrower',
  member:        'member',
};

// ── GET /api/onboarding/me ──────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [profileRes, memberRes, legacyRes] = await Promise.allSettled([
      adminSupabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      // New table: organization_members (has app_role column)
      adminSupabase
        .from('organization_members')
        .select('app_role, status, organization_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      // Legacy table: org_memberships (has role column = "admin", "investor", etc.)
      adminSupabase
        .from('org_memberships')
        .select('role, org_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
    const membership = memberRes.status === 'fulfilled' ? memberRes.value.data : null;
    const legacy = legacyRes.status === 'fulfilled' ? legacyRes.value.data : null;

    // Priority: organization_members.app_role > JWT claim > org_memberships.role
    const appRole =
      membership?.app_role ??
      req.role ??
      (legacy?.role ? LEGACY_ROLE_MAP[legacy.role] ?? 'lender_admin' : null) ??
      'member';

    const orgId = membership?.organization_id ?? req.orgId ?? legacy?.org_id ?? null;

    const portal = (() => {
      if (['platform_admin','lender_admin','servicer','asset_manager'].includes(appRole)) return 'lender';
      if (appRole === 'investor') return 'investor';
      if (appRole === 'borrower') return 'borrower';
      return 'lender';
    })();

    return res.json({ profile, app_role: appRole, org_id: orgId, portal });
  } catch (err) {
    console.error('[onboarding] /me error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/onboarding/members ─────────────────────────────────
router.get('/members', requireLenderRole, async (req, res) => {
  try {
    const orgId = req.orgId;
    if (!orgId) return res.status(400).json({ error: 'Org context missing' });

    const { data, error } = await adminSupabase
      .from('organization_members')
      .select('id, user_id, app_role, status, created_at, profiles(id, email, full_name, avatar_url)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return res.json({ members: data ?? [] });
  } catch (err) {
    console.error('[onboarding] /members error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/onboarding/invite ─────────────────────────────────
// Body: { email, full_name, app_role, org_id? }
// Creates a Supabase auth user, profile, and org membership.
// Supabase sends the invite email automatically.
router.post('/invite', requireLenderRole, async (req, res) => {
  try {
    const { email, full_name, app_role, org_id } = req.body;

    if (!email || !app_role) {
      return res.status(400).json({ error: 'email and app_role are required' });
    }
    if (!VALID_APP_ROLES.includes(app_role)) {
      return res.status(400).json({ error: `Invalid app_role. Valid: ${VALID_APP_ROLES.join(', ')}` });
    }

    // Only lender_admin/platform_admin can create other admins
    if (['platform_admin', 'lender_admin'].includes(app_role) && req.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Only platform_admin can create admin users' });
    }

    const targetOrgId = org_id ?? req.orgId;
    if (!targetOrgId) return res.status(400).json({ error: 'org_id required' });
    // organizations.id is BIGINT — ensure it's a number for the RPC call
    const numericOrgId = Number(targetOrgId);

    // 1. Create (or invite) auth user via service role
    const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name, app_role, org_id: targetOrgId },
    });

    if (inviteError) {
      // If user already exists, look them up instead
      if (!inviteError.message?.includes('already registered')) throw inviteError;
    }

    const authUserId = inviteData?.user?.id;

    // 2. Upsert via the server-side onboard_user helper
    if (authUserId) {
      await adminSupabase.rpc('onboard_user', {
        p_user_id:    authUserId,
        p_org_id:     numericOrgId,
        p_app_role:   app_role,
        p_full_name:  full_name ?? null,
        p_email:      email,
      });
    }

    return res.status(201).json({
      message:   `Invite sent to ${email}`,
      user_id:   authUserId ?? null,
      app_role,
      org_id:    targetOrgId,
    });
  } catch (err) {
    console.error('[onboarding] /invite error', err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// ── POST /api/onboarding/assign-role ────────────────────────────
// Body: { user_id, app_role }
// Updates an existing org member's role and refreshes their JWT claims.
router.post('/assign-role', requireLenderRole, async (req, res) => {
  try {
    const { user_id, app_role } = req.body;
    if (!user_id || !app_role) {
      return res.status(400).json({ error: 'user_id and app_role are required' });
    }
    if (!VALID_APP_ROLES.includes(app_role)) {
      return res.status(400).json({ error: `Invalid app_role. Valid: ${VALID_APP_ROLES.join(', ')}` });
    }
    if (['platform_admin', 'lender_admin'].includes(app_role) && req.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Only platform_admin can assign admin roles' });
    }

    const orgId = req.orgId;

    const { error } = await adminSupabase
      .from('organization_members')
      .update({ app_role, updated_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .eq('organization_id', orgId);

    if (error) throw error;

    // Log the role change to audit_logs
    await adminSupabase.from('audit_logs').insert({
      organization_id: orgId,
      actor_id:        req.user?.id,
      actor_role:      req.role,
      entity_type:     'organization_members',
      entity_id:       user_id,
      action:          'role_assigned',
      after_state:     { app_role },
    });

    return res.json({ message: `Role updated to ${app_role} for user ${user_id}` });
  } catch (err) {
    console.error('[onboarding] /assign-role error', err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

module.exports = router;
