function requireOrgContext(req, res, next) {
  if (!req.path.startsWith('/api')) {
    return next();
  }

  if (
    req.path === '/api/health' ||
    req.path.startsWith('/api/auth') ||
    req.path.startsWith('/api/sso')
  ) {
    return next();
  }

  const orgHeader = req.get('X-Org-Id') || req.get('x-org-id') || req.get('x-organization-id');

  if (!orgHeader) {
    return res.status(400).json({
      code: 'ORG_CONTEXT_MISSING',
      message: 'Missing X-Org-Id header',
    });
  }

  req.orgId = String(orgHeader);
  return next();
}

module.exports = { requireOrgContext };
