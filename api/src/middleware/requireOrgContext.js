function requireOrgContext(req, res, next) {
  const path = (req.originalUrl || '').split('?')[0];

  if (path === '/api/health' || path.startsWith('/api/dev/')) {
    return next();
  }

  const orgHeader = req.get('X-Org-Id') || req.get('x-org-id') || req.get('x-organization-id');
  const resolvedOrgId = orgHeader || req.organizationId || req.orgId || null;

  if (!req.user) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authentication required before organization context can be resolved.',
    });
  }

  if (!resolvedOrgId) {
    return res.status(400).json({
      code: 'ORG_CONTEXT_MISSING',
      message: 'Organization context is required for this request.',
    });
  }

  req.orgId = String(resolvedOrgId);
  req.organizationId = req.orgId;
  req.tenant_id = req.orgId;
  return next();
}

module.exports = { requireOrgContext };
