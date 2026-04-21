const express = require('express');
const crypto = require('crypto');
const { supabase, replica } = require('../db');

const router = express.Router();

const PROVIDERS = ['saml', 'oauth', 'oidc'];
const SSO_BASE_URL = process.env.SSO_BASE_URL || 'https://sso.example.com';
const ssoConfigStore = new Map();

async function loadOrganization(orgId) {
  if (!orgId) return null;
  const { data, error } = await replica
    .from('organizations')
    .select('id, name, branding')
    .eq('id', orgId)
    .maybeSingle();
  if (error) {
    console.error('SSO organization lookup failed', error);
    return null;
  }
  return data;
}

async function resolveUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      console.error('SSO config token validation failed', error);
      return null;
    }
    return data?.user ?? null;
  } catch (err) {
    console.error('SSO config token validation threw', err);
    return null;
  }
}

async function resolveMemberRole(orgId, userId) {
  if (!orgId || !userId) return null;
  try {
    const { data } = await replica
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
    return data?.role || null;
  } catch (err) {
    console.error('SSO role lookup failed', err);
    return null;
  }
}

router.get('/config', async (req, res) => {
  const orgId =
   req.headers['x-organization-id'] || req.headers['x-org-id'] || req.query.orgId || null;
  const organization = await loadOrganization(orgId);
  const user = await resolveUser(req.headers.authorization);
  const role = await resolveMemberRole(orgId, user?.id);
  
  const savedConfig = orgId ? (ssoConfigStore.get(String(orgId)) || null) : null;

  res.json({
    providers: PROVIDERS.map((name) => ({
      name,
      loginPath: `/api/sso/${name}/login`,
      enabled: true,
    })),
    organization,
    role: role || 'guest',
    requiresOrgMembership: true,
    savedConfig,
  });
});

router.post('/config', async (req, res) => {
  const orgId =
    req.body?.orgId || req.headers['x-organization-id'] || req.headers['x-org-id'] || null;
  if (!orgId) {
    return res.status(400).json({ message: 'orgId is required' });
  }

  const provider = String(req.body?.provider || '').toLowerCase();
  const domain = String(req.body?.domain || '').trim().toLowerCase();

  if (!PROVIDERS.includes(provider)) {
    return res.status(400).json({ message: 'Unsupported SSO provider' });
  }

  if (!domain) {
    return res.status(400).json({ message: 'domain is required' });
  }

  const config = {
    orgId: String(orgId),
    provider,
    domain,
    updatedAt: new Date().toISOString(),
  };
  ssoConfigStore.set(String(orgId), config);

  return res.status(201).json({ config });
});

router.post('/:provider/login', async (req, res) => {
  const provider = req.params.provider?.toLowerCase();
  if (!PROVIDERS.includes(provider)) {
    return res.status(400).json({ message: 'Unsupported SSO provider' });
  }

 const orgId =
    req.body?.orgId || req.headers['x-organization-id'] || req.headers['x-org-id'] || null;
  const loginHint = req.body?.email || '';
  const state = crypto.randomUUID();
  const organization = await loadOrganization(orgId);

  const url = new URL(`${SSO_BASE_URL.replace(/\/$/, '')}/${provider}/authorize`);
  url.searchParams.set('state', state);
  if (orgId) url.searchParams.set('org', orgId);
  if (loginHint) url.searchParams.set('login_hint', loginHint);

  res.json({
    url: url.toString(),
    state,
    organization,
    provider,
  });
});

router.post('/:provider/callback', async (req, res) => {
  const provider = req.params.provider?.toLowerCase();
  if (!PROVIDERS.includes(provider)) {
    return res.status(400).json({ message: 'Unsupported SSO provider' });
  }

  const { orgId, email, profile = {} } = req.body || {};
  if (!email) {
    return res.status(400).json({ message: 'Email is required to finish SSO' });
  }

  const organization = await loadOrganization(orgId);
  const resolvedUserId = profile.sub || profile.user_id || email;
  const role = (await resolveMemberRole(orgId, resolvedUserId)) || 'member';
  const token = Buffer.from(`${provider}:${email}:${Date.now()}`).toString('base64');

  res.json({
    token,
    provider,
    organization,
    role,
    user: {
      email,
      provider,
      profile,
    },
  });
});

module.exports = router;
