const { supabase } = require('../db');

const SELLER_ROLES = ['admin', 'capital_markets', 'lender'];
const COMPLIANCE_ROLES = ['admin', 'compliance', 'capital_markets'];

function normalizeGroups(input) {
  if (Array.isArray(input)) return input;
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
}

function getTenantId(req) {
 return req.organizationId || req.orgId || req.headers['x-organization-id'] || req.headers['x-org-id'];
}

function getUserWallet(req) {
  return req.user?.user_metadata?.wallet_address || req.user?.user_metadata?.wallet || null;
}

function getUserGroups(req) {
  return normalizeGroups(req.user?.user_metadata?.whitelist_groups || []);
}

function isSellerRole(role) {
  return SELLER_ROLES.includes(role);
}

function isComplianceRole(role) {
  return COMPLIANCE_ROLES.includes(role);
}

async function ensureTenantContext(req) {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    const error = new Error('Tenant context is required');
    error.statusCode = 400;
    throw error;
  }
  return tenantId;
}

async function ensureSellerRole(req) {
  if (!isSellerRole(req.role)) {
    const error = new Error('Seller role required');
    error.statusCode = 403;
    throw error;
  }
}

async function ensureWhitelistAccess({ offeringId, tenantId, orgId, walletAddress, groups }) {
  const { data, error } = await supabase
    .from('offering_access')
    .select('id, access_type, org_id, wallet_address, group_key, market_id')
    .eq('tenant_id', tenantId)
    .eq('offering_id', offeringId);

  if (error) {
    const err = new Error('Unable to verify offering access');
    err.statusCode = 500;
    throw err;
  }

  const groupSet = new Set(groups || []);
  const allowed = (data || []).some((entry) => {
    if (entry.org_id && orgId && entry.org_id === orgId) return true;
    if (entry.wallet_address && walletAddress && entry.wallet_address === walletAddress) return true;
    if (entry.group_key && groupSet.has(entry.group_key)) return true;
    return false;
  });

  if (!allowed) {
    const err = new Error('Offering is not available to this account');
    err.statusCode = 403;
    throw err;
  }
}

async function ensureKycApproved({ tenantId, orgId, walletAddress }) {
  const query = supabase
    .from('kyc_registry')
    .select('kyc_status, accreditation')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (orgId) {
    query.eq('org_id', orgId);
  } else if (walletAddress) {
    query.eq('wallet_address', walletAddress);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    const err = new Error('Unable to verify KYC status');
    err.statusCode = 500;
    throw err;
  }

  if (!data || data.kyc_status !== 'approved' || data.accreditation !== 'verified') {
    const err = new Error('KYC or accreditation approval required');
    err.statusCode = 403;
    throw err;
  }
}

async function ensureOfferingOwnership({ offeringId, tenantId }) {
  const { data, error } = await supabase
    .from('offering')
    .select('id, tenant_id')
    .eq('id', offeringId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) {
    const err = new Error('Offering not found for tenant');
    err.statusCode = 404;
    throw err;
  }
  return data;
}

async function ensureTradeAccess({ tradeId, tenantId, orgId, role }) {
  const { data, error } = await supabase
    .from('trades')
    .select('id, buyer_org_id, seller_org_id, status')
    .eq('id', tradeId)
    .maybeSingle();

  if (error || !data) {
    const err = new Error('Trade not found');
    err.statusCode = 404;
    throw err;
  }

  if (data.buyer_org_id !== orgId && data.seller_org_id !== orgId && !isComplianceRole(role)) {
    const err = new Error('Trade access denied');
    err.statusCode = 403;
    throw err;
  }

  return data;
}

module.exports = {
  getTenantId,
  getUserWallet,
  getUserGroups,
  isSellerRole,
  isComplianceRole,
  ensureTenantContext,
  ensureSellerRole,
  ensureWhitelistAccess,
  ensureKycApproved,
  ensureOfferingOwnership,
  ensureTradeAccess,
};
