'use strict';

function requireMembershipRole(...allowedRoles) {
  const allowed = new Set(allowedRoles.flat());
  return function membershipRoleGuard(req, res, next) {
    if (!req.membership || !req.authUserId) {
      return res.status(403).json({ code: 'ORG_MEMBERSHIP_REQUIRED' });
    }
    if (!allowed.has(req.membershipRole)) {
      return res.status(403).json({ code: 'ORG_ROLE_FORBIDDEN' });
    }
    return next();
  };
}

module.exports = requireMembershipRole;
