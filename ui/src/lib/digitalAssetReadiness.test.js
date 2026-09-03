import {
  isDigitalAssetLayerEnabled,
  isDigitalAssetReadinessOptedIn,
} from './digitalAssetReadiness';

describe('Digital Asset Readiness live creation gates', () => {
  test('creation opt-in is off unless explicitly checked', () => {
    expect(isDigitalAssetReadinessOptedIn({})).toBe(false);
    expect(isDigitalAssetReadinessOptedIn({ digitalAssetReadiness: false })).toBe(false);
    expect(isDigitalAssetReadinessOptedIn({ digitalAssetReadiness: true })).toBe(true);
  });

  test('explicit off overrides the tokenization-pack legacy default', () => {
    expect(isDigitalAssetLayerEnabled(
      { deal_type: 'tokenization', metadata_values: { digital_asset_enabled: false } },
      { id: 'tokenization' },
    )).toBe(false);
  });

  test('legacy and explicit-on rooms remain enabled', () => {
    expect(isDigitalAssetLayerEnabled(
      { deal_type: 'tokenization', metadata_values: {} },
      { id: 'tokenization' },
    )).toBe(true);
    expect(isDigitalAssetLayerEnabled(
      { metadata_values: { digital_asset_enabled: true } },
      { id: 'business_acquisition' },
    )).toBe(true);
  });
});