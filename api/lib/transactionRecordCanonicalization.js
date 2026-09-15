const {
  UNIVERSAL_ALIASES,
  PACK_ALIASES,
  getPackAliases,
  canonicalizeTransactionRecordKey,
  aliasKeysForCanonical,
} = require('../../shared/transactionRecordCanonicalization');

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
  if ((!machineKey || machineKey === packKey) && TRANSACTION_TYPE_LABELS[packKey]) {
    return TRANSACTION_TYPE_LABELS[packKey];
  }
  return String(fallbackLabel || machineType || workflowKey || '').trim().slice(0, 200);
}

module.exports = {
  UNIVERSAL_ALIASES,
  PACK_ALIASES,
  getPackAliases,
  TRANSACTION_TYPE_LABELS,
  canonicalTransactionTypeLabel,
  canonicalizeTransactionRecordKey,
  aliasKeysForCanonical,
};