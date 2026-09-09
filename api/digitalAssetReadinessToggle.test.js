'use strict';

const {
  buildDigitalAssetReadinessToggle,
  isDigitalAssetReadinessEnabled,
} = require('./lib/digitalAssetReadinessToggle');

describe('existing-room Digital Asset Readiness toggle', () => {
  test('enables an OFF room without changing its existing transaction state', () => {
    const transactionState = {
      stage: 'review',
      recordFields: [
        { field_key: 'transaction.purchase_price', value_text: '8500000', status: 'verified' },
      ],
      provenance: [{ field_key: 'transaction.purchase_price', source_doc_id: 'purchase-agreement' }],
      verificationHistory: [{ event_type: 'manual_edit', field_key: 'transaction.purchase_price' }],
    };
    const originalTransactionState = structuredClone(transactionState);
    const metadataValues = {
      digital_asset_enabled: false,
      transaction_value: '8500000',
      target_close_date: '2026-12-31',
    };

    const result = buildDigitalAssetReadinessToggle({
      metadataValues,
      enabled: true,
      hasHistoricalArtifacts: false,
    });

    expect(result).toEqual({
      ok: true,
      changed: true,
      enabled: true,
      metadataValues: {
        ...metadataValues,
        digital_asset_enabled: true,
      },
    });
    expect(transactionState).toEqual(originalTransactionState);
    expect(isDigitalAssetReadinessEnabled(result.metadataValues)).toBe(true);
  });

  test('preserves unrelated metadata when enabling', () => {
    const result = buildDigitalAssetReadinessToggle({
      metadataValues: {
        jurisdiction: 'eu_mica',
        transaction_type: 'business_acquisition',
        custom_note: 'keep me',
      },
      enabled: true,
    });

    expect(result.metadataValues).toEqual({
      jurisdiction: 'eu_mica',
      transaction_type: 'business_acquisition',
      custom_note: 'keep me',
      digital_asset_enabled: true,
    });
  });

  test('blocks disabling after historical artifacts exist', () => {
    const result = buildDigitalAssetReadinessToggle({
      metadataValues: { digital_asset_enabled: true },
      enabled: false,
      hasHistoricalArtifacts: true,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('DIGITAL_ASSET_READINESS_HAS_HISTORY');
  });
});