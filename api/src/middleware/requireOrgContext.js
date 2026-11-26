'use strict';

const authenticate = require('../../middlewares/authenticate');
const { supabase } = require('../../db');
const { UUID_RE, resolveCanonicalIdentity } = require('../../middlewares/resolveCanonicalIdentity');

function requestPath(req) {
  return (req.originalUrl || req.url || '').split('?')[0];
}

function isExempt(req) {
  const path = requestPath(req);
  const mounted = (req.url || '').split('?')[0];
  const method = String(req.method || 'GET').toUpperCase();
  return path === '/api/health' ||
    (method === 'POST' && path === '/api/organizations') ||
    (method === 'GET' && path === '/api/plans') ||
    mounted === '/health' ||
    path.startsWith('/api/dev/') ||
    mounted.startsWith('/dev/') ||
    path.startsWith('/api/auth/') ||
    mounted.startsWith('/auth/') ||
    path.startsWith('/api/copilot/') ||
    mounted.startsWith('/copilot/') ||
    path.startsWith('/api/checkout/guest') ||
    mounted.startsWith('/checkout/guest') ||
    path.startsWith('/api/public/') ||
    mounted.startsWith('/public/') ||
    path === '/api/waitlist' ||
    mounted === '/waitlist' ||
    path === '/api/payments/stablecoin/webhook' ||
    path === '/api/otp/request' ||
    path === '/api/otp/verify';
}

function candidateOrgIds(req) {
  const rawHeaders = [
    req.headers['x-org-id'],
    req.headers['x-organization-id'],
  ].filter(Boolean);
  if (rawHeaders.some(Array.isArray)) {
    return { error: 'ORG_CONTEXT_AMBIGUOUS' };
  }
  const body = req.body || {};
  const query = req.query || {};
  const raw = [
    ...rawHeaders,
    query.orgId,
    query.org_id,
    body.orgId,
    body.org_id,
  ].filter((value) => value !== undefined && value !== null && value !== '');
  const values = [...new Set(raw.map(String))];
  if (values.length > 1) return { error: 'ORG_CONTEXT_AMBIGUOUS' };
  if (values.length && !UUID_RE.test(values[0])) return { error: 'ORG_CONTEXT_INVALID' };
  return { orgId: values[0] || null };
}

function createRequireOrgContext({ auth = authenticate, db = supabase } = {}) {
  return function requireOrgContext(req, res, next) {
    if (isExempt(req)) return next();

    return auth(req, res, async (authError) => {
      if (authError) return next(authError);
      if (!req.authContext?.verified) {
        return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Authentication required' });
      }

      try {
        const identity = await resolveCanonicalIdentity(req, db);
        if (identity.error) {
          return res.status(503).json({ code: 'IDENTITY_LOOKUP_UNAVAILABLE' });
        }
        if (!identity.userId) {
          return res.status(403).json({ code: 'IDENTITY_LINK_REQUIRED' });
        }

        const candidate = candidateOrgIds(req);
        if (candidate.error) {
          return res.status(400).json({ code: candidate.error });
        }

        let query = db
          .from('org_memberships')
          .select('id, org_id, user_id, role, status, deleted_at, created_at, organizations!inner(status)')
          .eq('user_id', identity.userId)
          .eq('status', 'active')
          .is('deleted_at', null)
          .eq('organizations.status', 'active')
          .order('created_at', { ascending: true });
        const { data: memberships, error } = await query;
        if (error) {
          console.error('[OrgAuth] membership lookup failed', error.message);
          return res.status(503).json({ code: 'ORG_AUTHORIZATION_UNAVAILABLE' });
        }

        const active = memberships || [];
        const membership = candidate.orgId
          ? active.find((item) => String(item.org_id) === candidate.orgId)
          : active[0];
        if (!membership) {
          return res.status(403).json({
            code: candidate.orgId ? 'ORG_FORBIDDEN' : 'ORG_MEMBERSHIP_REQUIRED',
            message: 'Active organization membership required',
          });
        }

        req.authUserId = identity.userId;
        req.membership = membership;
        req.membershipRole = membership.role;
        req.orgId = String(membership.org_id);
        req.organizationId = req.orgId;
        req.tenant_id = req.orgId;
        return next();
      } catch (error) {
        console.error('[OrgAuth] authorization failed', error.message);
        return res.status(503).json({ code: 'ORG_AUTHORIZATION_UNAVAILABLE' });
      }
    });
  };
}

const requireOrgContext = createRequireOrgContext();
module.exports = { requireOrgContext, createRequireOrgContext, candidateOrgIds, isExempt };
