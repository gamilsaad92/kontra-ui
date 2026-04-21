// Convert integer org IDs (e.g. "20") to UUID format used in Supabase tables.
// This ensures all routes — including the AI routes that use req.orgId directly —
// receive the correct UUID without needing to call toOrgUuid() in every handler.
function toOrgUuidStr(orgId) {
  if (!orgId) return orgId;
  const id = String(orgId);
  // Already a UUID (contains hyphens) — pass through
  if (/[0-9a-f]{8}-/i.test(id)) return id;
  // Pure integer → pad to UUID format
  if (/^\d+$/.test(id)) {
    return `00000000-0000-0000-0000-${id.padStart(12, '0')}`;
  }
  return orgId;
}

function requireOrgContext(req, res, next) {
  const path = (req.originalUrl || '').split('?')[0];

  // Always skip health and dev routes
  if (path === '/api/health' || path.startsWith('/api/dev/') || path.startsWith('/api/auth/')) {
    return next();
  }

  const orgHeader = req.get('X-Org-Id') || req.get('x-org-id') || req.get('x-organization-id');

  // If an explicit header is provided, convert it to UUID format and move on
  if (orgHeader) {
    req.orgId = toOrgUuidStr(String(orgHeader));
    req.organizationId = req.orgId;
    req.tenant_id = req.orgId;
    return next();
  }

  // If req.orgId was already set (e.g. by authenticate running earlier), accept it
  if (req.orgId) {
    req.orgId = toOrgUuidStr(req.orgId);
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
