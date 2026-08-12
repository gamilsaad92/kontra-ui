// Canonical Transaction Record key mapping shared by extraction and readiness.
const UNIVERSAL_ALIASES = {
  'financial.purchase_price': 'transaction.purchase_price',
  'financial.deal_value': 'transaction.value',
  'transaction.target_closing_date': 'transaction.closing_date',
  'transaction.target_close_date': 'transaction.closing_date',
  'transaction.due_diligence_expiration': 'transaction.dd_expiration',
  'financial.annual_revenue': 'financial.revenue',
  'financial.total_revenue': 'financial.revenue',
};
const PACK_ALIASES = {
  business_acquisition: {
    'asset_identity.legal_name': 'asset.legal_name',
    'asset_identity.industry': 'asset.industry',
    'asset_identity.entity_type': 'asset.entity_type',
    'beneficial_ownership.owners': 'ownership.existing_owners',
  },
  cre_acquisition: {
    'asset_identity.legal_name': 'asset.name',
    'beneficial_ownership.owners': 'ownership.titled_owner',
  },
  fundraising: {
    'asset_identity.legal_name': 'asset.issuer',
    'asset_identity.entity_type': 'asset.entity_type',
  },
  tokenization: {
    'asset_identity.legal_name': 'asset.name',
    'beneficial_ownership.owners': 'ownership.beneficial_owners',
  },
  generic: {
    'asset_identity.legal_name': 'asset.name',
    'beneficial_ownership.owners': 'ownership.owners',
  },
};
function getPackAliases(packId = 'generic') {
  return { ...PACK_ALIASES.generic, ...(PACK_ALIASES[packId] || {}) };
}
function canonicalizeTransactionRecordKey(fieldKey, packId = 'generic') {
  const key = String(fieldKey || '').trim();
  if (!key) return key;
  return getPackAliases(packId)[key] || UNIVERSAL_ALIASES[key] || key;
}
function aliasKeysForCanonical(canonicalKey, packId = 'generic') {
  const aliases = new Set([canonicalKey]);
  for (const [alias, destination] of Object.entries({ ...UNIVERSAL_ALIASES, ...getPackAliases(packId) })) {
    if (destination === canonicalKey) aliases.add(alias);
  }
  return [...aliases];
}
module.exports = { UNIVERSAL_ALIASES, PACK_ALIASES, canonicalizeTransactionRecordKey, aliasKeysForCanonical };