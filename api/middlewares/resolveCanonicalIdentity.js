'use strict';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveCanonicalIdentity(req, supabase) {
  if (req.authProvider === 'supabase' && req.authSubject) {
    req.authUserId = String(req.authSubject);
    req.user = { ...req.user, supabaseUserId: req.authUserId };
    return { userId: req.authUserId };
  }

  if (req.authProvider !== 'local' || !req.authSubject || !supabase) {
    return { userId: null, linked: false };
  }

  const { data, error } = await supabase
    .from('local_auth_identity_links')
    .select('auth_user_id')
    .eq('issuer', 'kontra-local')
    .eq('subject', String(req.authSubject))
    .maybeSingle();

  if (error) return { userId: null, linked: false, error };
  if (!data?.auth_user_id || !UUID_RE.test(String(data.auth_user_id))) {
    return { userId: null, linked: false };
  }

  req.authUserId = String(data.auth_user_id);
  req.user = { ...req.user, supabaseUserId: req.authUserId };
  return { userId: req.authUserId, linked: true };
}

module.exports = { UUID_RE, resolveCanonicalIdentity };
