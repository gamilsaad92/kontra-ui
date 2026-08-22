// Canonical Transaction Record key mapping shared by extraction and readiness.
//
// AI output is allowed to use descriptive category names, but persistence must
// use exactly one key for each real-world fact. Pack-specific aliases are kept
// here so a custom/business room does not accidentally use a CRE or fundraising
// field as its canonical destination.

const UNIVERSAL_ALIASES = {
  'financial.purchase_price': 'transaction.purchase_price',
  'financial.deal_value': 'transaction.value',
  'transaction.target_closing_date': 'transaction.closing_date',
  'transaction.target_close_date': 'transaction.closing_date',
  'transaction.due_diligence_expiration': 'transaction.dd_expiration',
  'financial.annual_revenue': 'financial.revenue',
  'financial.total_revenue': 'financial.revenue',
  'financial.borrower_advanced_funds': 'financial.borrower_funds_advanced',
  'financial.borrower_funds_advanced_amount': 'financial.borrower_funds_advanced',
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

const TRANSACTION_TYPE_LABELS = Object.freeze({
  cre_acquisition: 'Commercial Real Estate Acquisition',
  business_acquisition: 'Business Acquisition',
  fundraising: 'Fundraising Round',
  tokenization: 'Token Issuance / STO',
});

/**
 * Resolve the display label from the authoritative machine type/workflow key.
 * AI-provided labels are only a fallback for non-built-in/custom transaction
 * types; they must never override a known built-in workflow label.
 */
function canonicalTransactionTypeLabel(machineType, workflowKey, fallbackLabel = '') {
  const machineKey = String(machineType || '').trim().toLowerCase();
  const packKey = String(workflowKey || '').trim().toLowerCase();

  if (TRANSACTION_TYPE_LABELS[machineKey]) return TRANSACTION_TYPE_LABELS[machineKey];
  // Only use the workflow key when the machine type is absent or is the same
  // built-in key. Non-built-in machine types (e.g. lending) keep their own
  // human-readable label rather than being relabeled as the storage pack.
  if ((!machineKey || machineKey === packKey) && TRANSACTION_TYPE_LABELS[packKey]) {
    return TRANSACTION_TYPE_LABELS[packKey];
  }
  return String(fallbackLabel || machineType || workflowKey || '').trim().slice(0, 200);
}

function getPackAliases(packId = 'generic') {
  return {
    ...PACK_ALIASES.generic,
    ...(PACK_ALIASES[packId] || {}),
  };
}

function canonicalizeTransactionRecordKey(fieldKey, packId = 'generic') {
  const key = String(fieldKey || '').trim();
  if (!key) return key;
  const packAliases = getPackAliases(packId);
  return packAliases[key] || UNIVERSAL_ALIASES[key] || key;
}

function aliasKeysForCanonical(canonicalKey, packId = 'generic') {
  const aliases = new Set([canonicalKey]);
  const packAliases = getPackAliases(packId);
  for (const [alias, destination] of Object.entries({ ...UNIVERSAL_ALIASES, ...packAliases })) {
    if (destination === canonicalKey) aliases.add(alias);
  }
  return [...aliases];
}

module.exports = {
  UNIVERSAL_ALIASES,
  PACK_ALIASES,
  TRANSACTION_TYPE_LABELS,
  canonicalTransactionTypeLabel,
  canonicalizeTransactionRecordKey,
  aliasKeysForCanonical,
};