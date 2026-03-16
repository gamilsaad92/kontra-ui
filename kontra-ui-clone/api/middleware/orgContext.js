const orgContext = (req, res, next) => {
  const headerOrg =
    req.headers['x-organization-id'] ||
    req.headers['x-org-id'] ||
    req.headers['organization-id'];

  const orgId = headerOrg || req.query.orgId || req.body?.orgId || req.body?.organizationId;

  const userId = req.headers['x-user-id'] || req.query.userId || req.body?.userId;

  if (!orgId) {
    return res.status(400).json({ code: 'ORG_CONTEXT_MISSING', message: 'Missing X-Org-Id header' });
  }

  req.orgId = String(orgId);
  req.userId = userId ? String(userId) : null;

  next();
};

module.exports = { orgContext };
