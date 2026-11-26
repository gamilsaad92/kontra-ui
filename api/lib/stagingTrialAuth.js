'use strict';

function stagingDemoRouteGuard(enabled) {
  return function guardStagingDemoRoute(req, res, next) {
    if (enabled) {
      return res.status(404).json({ error: 'not_found' });
    }
    return next();
  };
}

function parseAllowedTesterEmails(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function stagingTrialRoomOrganizationLink(enabled, req, propertyId) {
  const organizationId = String(req?.stagingTrialOrganizationId || '').trim();
  const userId = String(req?.stagingTrialUser?.id || '').trim();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!enabled || !uuidPattern.test(organizationId) || !uuidPattern.test(userId)
      || typeof propertyId !== 'string' || !propertyId.trim()) {
    return null;
  }
  return {
    organization_id: organizationId,
    property_id: propertyId.trim(),
    created_by: userId,
  };
}

function stagingTrialAuth(enabled, supabase, allowedTesterEmails) {
  const allowedEmails = parseAllowedTesterEmails(allowedTesterEmails);

  return async function requireStagingTrialAuth(req, res, next) {
    if (!enabled) return next();

    if (allowedEmails.size === 0) {
      return res.status(503).json({
        error: 'staging_testers_not_configured',
        message: 'Trial-room creation is disabled until approved staging testers are configured.',
      });
    }

    const authorization = String(req.headers?.authorization || '');
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match || !match[1].trim()) {
      return res.status(401).json({
        error: 'staging_auth_required',
        message: 'Sign in with a staging account before creating a trial room.',
      });
    }

    if (typeof supabase?.auth?.getUser !== 'function') {
      return res.status(503).json({ error: 'staging_auth_unavailable' });
    }

    try {
      const { data, error } = await supabase.auth.getUser(match[1].trim());
      const user = data?.user;
      if (error || !user?.id || !user.email) {
        return res.status(401).json({
          error: 'staging_auth_required',
          message: 'A valid staging sign-in is required to create a trial room.',
        });
      }
      const normalizedEmail = String(user.email).trim().toLowerCase();
      if (!allowedEmails.has(normalizedEmail)) {
        return res.status(403).json({
          error: 'staging_tester_not_approved',
          message: 'This staging account is not approved to create trial rooms.',
        });
      }

      const requestedOrgId = String(
        req.body?.organizationId || req.body?.organization_id || '',
      ).trim();
      if (requestedOrgId) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedOrgId)) {
          return res.status(400).json({ error: 'invalid_organization_id' });
        }
        if (typeof supabase?.from !== 'function') {
          return res.status(503).json({ error: 'staging_membership_unavailable' });
        }
        const { data: membership, error: membershipError } = await supabase
          .from('org_memberships')
          .select('org_id, role, status, deleted_at')
          .eq('org_id', requestedOrgId)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .is('deleted_at', null)
          .maybeSingle();
        if (membershipError) {
          return res.status(503).json({ error: 'staging_membership_unavailable' });
        }
        if (!membership
          || membership.status !== 'active'
          || membership.deleted_at !== null
          || !['owner', 'admin'].includes(membership.role)) {
          return res.status(403).json({ error: 'organization_transaction_creation_forbidden' });
        }
        req.stagingTrialOrganizationId = membership.org_id;
      }

      req.stagingTrialUser = { ...user, email: normalizedEmail };
      return next();
    } catch {
      return res.status(503).json({ error: 'staging_auth_unavailable' });
    }
  };
}

module.exports = {
  parseAllowedTesterEmails,
  stagingTrialRoomOrganizationLink,
  stagingDemoRouteGuard,
  stagingTrialAuth,
};
