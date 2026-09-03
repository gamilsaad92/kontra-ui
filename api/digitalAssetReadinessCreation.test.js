const app = require('./index');

describe('Digital Asset Readiness creation opt-in', () => {
  test('persists the default-off choice in the existing metadata structure', () => {
    const metadata = app.buildCreationMetadata({
      propertyName: 'Acme Acquisition',
      workflowPackId: 'business_acquisition',
    });

    expect(metadata.digital_asset_enabled).toBe(false);
    expect(app.isTokenizationTransaction(
      'business_acquisition',
      'business_acquisition',
      metadata,
    )).toBe(false);
  });

  test('persists an explicit opt-in without changing transaction metadata shape', () => {
    const metadata = app.buildCreationMetadata({
      propertyName: 'Tokenized Asset',
      workflowPackId: 'tokenization',
      transactionType: 'tokenization',
      digitalAssetEnabled: true,
    });

    expect(metadata.digital_asset_enabled).toBe(true);
    expect(metadata.workspace_name).toBe('Tokenized Asset');
    expect(app.isTokenizationTransaction('tokenization', 'tokenization', metadata)).toBe(true);
  });

  test('an explicit off choice overrides the historical tokenization-pack default', () => {
    expect(app.isTokenizationTransaction('tokenization', 'tokenization', {
      digital_asset_enabled: false,
    })).toBe(false);
  });

  test('legacy tokenization rooms without the new flag remain enabled', () => {
    expect(app.isTokenizationTransaction('tokenization', 'tokenization', {})).toBe(true);
    expect(app.isTokenizationTransaction('tokenization', 'tokenization')).toBe(true);
  });

  test('ordinary transaction records remain independent of the readiness opt-in', () => {
    const metadata = app.buildCreationMetadata({
      propertyName: 'Core Transaction',
      workflowPackId: 'business_acquisition',
      transactionType: 'business_acquisition',
      transactionValue: '8500000',
      transactionValueConfidence: 'high',
      digitalAssetEnabled: false,
    });

    expect(metadata.transaction_value).toBe('8500000');
    expect(metadata.transaction_type).toBeTruthy();
    expect(metadata.digital_asset_enabled).toBe(false);
  });
});