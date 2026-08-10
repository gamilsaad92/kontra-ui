module.exports = function requireOrg(req, res, next) {
  // Public deal-room endpoints use owner-write-token / invite-session auth — they
  // are never org-scoped and must pass through without an X-Org-Id header.
  // Check both req.originalUrl (full path) and req.url (mount-relative) so the
  // bypass works regardless of where this middleware is used.
  const fullUrl    = req.originalUrl || '';
  const mountedUrl = req.url || '';
  if (fullUrl.includes('/api/public/') || mountedUrl.startsWith('/public/')) {
    return next();
  }

  const orgId =
    req.organizationId || req.headers['x-organization-id'] || req.headers['x-org-id'];
  if (!orgId) {
    return res.status(400).json({ code: 'ORG_CONTEXT_MISSING', message: 'Missing X-Org-Id header' });
  }
  req.orgId = orgId;
  next();
};
