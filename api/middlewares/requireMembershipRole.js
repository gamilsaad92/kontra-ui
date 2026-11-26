'use strict';

function requireMembershipRole(...allowedRoles) {
  const allowed = new Set(allowedRoles.flat());
  return function membershipRoleGuard(req, res, next) {
    const membership = req.membership;
    const orgId = req.orgId || req.organizationId;
    const hasVerifiedMembership =
      req.authContext?.verified === true &&
      Boolean(req.authUserId) &&
      Boolean(orgId) &&
      membership?.status === 'active' &&
      !membership.deleted_at &&
      String(membership.user_id) === String(req.authUserId) &&
      String(membership.org_id) === String(orgId);

    if (!hasVerifiedMembership) {
      return res.status(403).json({ code: 'ORG_MEMBERSHIP_REQUIRED' });
    }
    if (
      !membership.role ||
      req.membershipRole !== membership.role ||
      !allowed.has(membership.role)
    ) {
      return res.status(403).json({ code: 'ORG_ROLE_FORBIDDEN' });
    }
    return next();
  };
}

module.exports = requireMembershipRole;
