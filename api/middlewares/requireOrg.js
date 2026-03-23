unction normalizeOrgId(value) {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : null;
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

module.exports = function requireOrg(req, res, next) {
   const headerOrgId = normalizeOrgId(req.headers['x-organization-id'] || req.headers['x-org-id']);
  const resolvedOrgId = headerOrgId || normalizeOrgId(req.organizationId || req.orgId || req.tenant_id);

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

  req.orgId = resolvedOrgId;
  req.organizationId = resolvedOrgId;
  req.tenant_id = resolvedOrgId;
  return next();
};
