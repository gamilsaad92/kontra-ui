module.exports = function requireOrg(req, res, next) {
  // Public deal-room endpoints use owner-write-token / invite-session auth — they
  // are never org-scoped and must pass through without an X-Org-Id header.
  // Check both req.originalUrl (full path) and req.url (mount-relative) so the
  // bypass works regardless of where this middleware is used.
  const fullPath = (req.originalUrl || '').split('?')[0];
  const mountedPath = (req.url || '').split('?')[0];
  if (fullPath.startsWith('/api/public/') || mountedPath.startsWith('/public/')) {
    return next();
  }

  const orgId = req.orgId || req.organizationId;
  const membership = req.membership;
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
  req.orgId = orgId;
  next();
};
