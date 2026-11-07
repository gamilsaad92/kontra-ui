'use strict';

async function isAuthenticatedTenantMember(supabase, req) {
  const userId = req.user?.supabaseUserId || req.user?.id;
  const organizationId = req.orgId;
  if (!userId || !organizationId) return false;

  const { data, error } = await supabase.from('organization_members')
    .select('user_id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle();
  return !error && Boolean(data?.user_id);
}

module.exports = { isAuthenticatedTenantMember };
