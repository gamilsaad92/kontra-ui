import {
  isDigitalAssetLayerEnabled,
  isDigitalAssetReadinessOptedIn,
} from './digitalAssetReadiness';

describe('Digital Asset Readiness UI gates', () => {
  test('creation opt-in defaults off and only enables for an explicit checked value', () => {
    expect(isDigitalAssetReadinessOptedIn({})).toBe(false);
    expect(isDigitalAssetReadinessOptedIn({ digitalAssetReadiness: false })).toBe(false);
    expect(isDigitalAssetReadinessOptedIn({ digitalAssetReadiness: true })).toBe(true);
  });

  test('new tokenization rooms can explicitly stay off', () => {
    expect(isDigitalAssetLayerEnabled(
      { deal_type: 'tokenization', metadata_values: { digital_asset_enabled: false } },
      { id: 'tokenization' },
    )).toBe(false);
  });

  test('legacy tokenization rooms and explicitly enabled rooms remain on', () => {
    expect(isDigitalAssetLayerEnabled(
      { deal_type: 'tokenization', metadata_values: {} },
      { id: 'tokenization' },
    )).toBe(true);
    expect(isDigitalAssetLayerEnabled(
      { deal_type: 'business_acquisition', metadata_values: { digital_asset_enabled: true } },
      { id: 'business_acquisition' },
    )).toBe(true);
  });
});