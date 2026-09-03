const TOKENIZATION_RELEVANT_TYPES = new Set([
  'tokenization',
  'token_issuance',
  'sto',
  'security_token',
  'digital_asset',
  'rwa',
]);

export function isDigitalAssetReadinessOptedIn(formValues) {
  return formValues?.digitalAssetReadiness === true;
}

export function isDigitalAssetLayerEnabled(property, pack) {
  const metadataEnabled = property?.metadata_values?.digital_asset_enabled;
  // An explicit creation-time choice overrides the historical tokenization
  // pack default. Rooms created before this flag existed retain the legacy
  // pack-based behavior below.
  if (metadataEnabled === false || metadataEnabled === 'false') return false;
  return pack?.id === 'tokenization'
    || pack?.transactionType === 'tokenization'
    || property?.deal_type === 'tokenization'
    || metadataEnabled === true
    || metadataEnabled === 'true';
}

export function isDigitalAssetTransactionType(type) {
  return TOKENIZATION_RELEVANT_TYPES.has(type);
}