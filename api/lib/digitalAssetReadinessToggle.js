'use strict';

function isDigitalAssetReadinessEnabled(metadataValues = {}) {
  return metadataValues.digital_asset_enabled === true
    || metadataValues.digital_asset_enabled === 'true';
}

function buildDigitalAssetReadinessToggle({
  metadataValues = {},
  enabled,
  hasHistoricalArtifacts = false,
} = {}) {
  if (typeof enabled !== 'boolean') {
    return {
      ok: false,
      code: 'INVALID_DIGITAL_ASSET_READINESS_STATE',
      message: 'enabled must be a boolean',
    };
  }

  const wasEnabled = isDigitalAssetReadinessEnabled(metadataValues);
  if (!enabled && wasEnabled && hasHistoricalArtifacts) {
    return {
      ok: false,
      code: 'DIGITAL_ASSET_READINESS_HAS_HISTORY',
      message: 'Digital Asset Readiness cannot be disabled after Verified Asset history or preparation artifacts exist.',
    };
  }

  return {
    ok: true,
    changed: wasEnabled !== enabled,
    enabled,
    metadataValues: {
      ...metadataValues,
      digital_asset_enabled: enabled,
    },
  };
}

module.exports = {
  isDigitalAssetReadinessEnabled,
  buildDigitalAssetReadinessToggle,
};