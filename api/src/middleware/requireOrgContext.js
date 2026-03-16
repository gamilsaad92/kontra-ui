function requireOrgContext(req, res, next) {
  // Use originalUrl so the full path is available regardless of where this
  // middleware is mounted (e.g. mounted at /api, req.path loses the prefix).
  const path = (req.originalUrl || '').split('?')[0];

  if (path === '/api/health' || path.startsWith('/api/dev/')) {
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
