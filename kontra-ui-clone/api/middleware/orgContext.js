const orgContext = (req, res, next) => {
  // Public deal-room routes use their own auth scheme — skip org requirement.
  const fullUrl    = req.originalUrl || '';
  const mountedUrl = req.url || '';
  if (fullUrl.includes('/api/public/') || mountedUrl.startsWith('/public/')) {
    return next();
  }
  const headerOrg =
    req.headers['x-organization-id'] ||
    req.headers['x-org-id'] ||
    req.headers['organization-id'];

  const orgId = headerOrg || req.query.orgId || req.body?.orgId || req.body?.organizationId;

  const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;

  // authenticate runs before this middleware on the legacy servicing,
  // payments, and marketplace routers. Reuse the tenant it resolved from
  // the bearer token when no per-request override was supplied.
  const resolvedOrgId = orgId || req.orgId;

  if (!resolvedOrgId) {
    return res.status(400).json({ code: 'ORG_CONTEXT_MISSING', message: 'Missing X-Org-Id header' });
  }

  req.orgId = String(resolvedOrgId);
  req.userId = userId ? String(userId) : null;

  next();
};

module.exports = { orgContext };
