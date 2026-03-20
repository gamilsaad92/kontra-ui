function requireOrgContext(req, res, next) {
  // Use originalUrl so the full path is available regardless of where this
  // middleware is mounted (e.g. mounted at /api, req.path loses the prefix).
  const path = (req.originalUrl || '').split('?')[0];

  if (path === '/api/health' || path.startsWith('/api/dev/')) {
    return next();
  }

  const orgHeader = req.get('X-Org-Id') || req.get('x-org-id') || req.get('x-organization-id');

  // Fall back to orgId already resolved by the authenticate middleware (DB lookup).
  // This allows requests from authenticated users whose JWT doesn't carry an
  // organization_id claim — the auth middleware already looked up their org from
  // the org_memberships table and placed it on req.orgId.
  const resolvedOrgId = orgHeader || req.orgId || null;

  if (!resolvedOrgId) {
    return res.status(400).json({
      code: 'ORG_CONTEXT_MISSING',
      message: 'Missing X-Org-Id header',
    });
  }

  req.orgId = String(resolvedOrgId);
  req.organizationId = req.orgId;
  req.tenant_id = req.orgId;
  return next();
}

module.exports = { requireOrgContext };
