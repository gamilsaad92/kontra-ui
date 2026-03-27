function requireOrgContext(req, res, next) {
  const path = (req.originalUrl || '').split('?')[0];

  // Always skip health and dev routes
  if (path === '/api/health' || path.startsWith('/api/dev/') || path.startsWith('/api/auth/')) {
    return next();
  }

  const orgHeader = req.get('X-Org-Id') || req.get('x-org-id') || req.get('x-organization-id');

  // If an explicit header is provided, apply it now and move on
  if (orgHeader) {
    req.orgId = String(orgHeader);
    req.organizationId = req.orgId;
    req.tenant_id = req.orgId;
    return next();
  }

  // If req.orgId was already set (e.g. by authenticate running earlier), accept it
  if (req.orgId) {
    req.organizationId = req.orgId;
    req.tenant_id = req.orgId;
    return next();
  }

  // If there's a Bearer token, authenticate middleware will resolve the org.
  // Pass through so authenticate can run and set req.orgId — the route handler
  // is responsible for enforcing org presence after authentication.
  const authHeader = req.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return next();
  }

  // No auth, no org header — block unauthenticated org-required requests
  return res.status(400).json({
    code: 'ORG_CONTEXT_MISSING',
    message: 'Missing X-Org-Id header',
  });
}

module.exports = { requireOrgContext };
