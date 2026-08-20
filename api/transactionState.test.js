const {
  computeTransactionReadiness,
  computeTransactionRecordState,
} = require('./lib/transactionState');

const requirements = require('../shared/transaction_record_requirements.json');

describe('transaction state recalculation', () => {
  it('removes not-applicable fields from the required denominator', () => {
    const required = requirements.cre_acquisition;
    const excluded = required[0];
    const fields = required.map((field, index) => ({
      field_key: field,
      value_text: index === 0 ? null : `confirmed-${index}`,
      status: index === 0 ? 'not_applicable' : 'verified',
    }));

    const result = computeTransactionReadiness(
      { workflow_pack_id: 'cre_acquisition' },
      fields,
      'cre_acquisition',
    );

    expect(result.notApplicableCount).toBe(1);
    expect(result.requiredCount).toBe(required.length - 1);
    expect(result.confirmedCount).toBe(required.length - 1);
    expect(result.overall).toBe(100);
    expect(excluded).toBeDefined();
  });

  it('canonicalizes aliases and lets a verified value win over an awaiting alias', () => {
    const result = computeTransactionRecordState([
      {
        field_key: 'financial.purchase_price',
        value_text: 'stale extracted value',
        status: 'extracted',
      },
      {
        field_key: 'transaction.purchase_price',
        value_text: '$5,000,000',
        status: 'verified',
      },
      {
        field_key: 'transaction.closing_date',
        value_text: '2026-09-30',
        status: 'confirmed',
      },
    ], 'cre_acquisition');

    const price = result.requiredFields.find(field => field.key === 'transaction.purchase_price');
    expect(price.status).toBe('confirmed');
    expect(price.value).toBe('$5,000,000');
    expect(result.confirmedCount).toBe(2);
  });

  it('exposes required and optional awaiting counts from one canonical state', () => {
    const requiredKey = requirements.cre_acquisition[0];
    const result = computeTransactionRecordState([
      { field_key: requiredKey, value_text: 'extracted value', status: 'extracted' },
      { field_key: 'financial.optional_note', value_text: 'optional value', status: 'needs_review' },
    ], 'cre_acquisition');

    expect(result.awaitingRequiredCount).toBe(1);
    expect(result.awaitingOptionalCount).toBe(1);
    expect(result.awaitingCount).toBe(2);
  });

  it('counts source-changed verified values as confirmed with visible attention', () => {
    const result = computeTransactionRecordState([
      {
        field_key: 'transaction.type',
        value_text: 'Commercial acquisition',
        status: 'source_changed',
      },
    ], 'cre_acquisition');

    const field = result.requiredFields.find(item => item.key === 'transaction.type');
    expect(field.status).toBe('confirmed');
    expect(field.attention).toBe('source_changed');
    expect(result.confirmedCount).toBe(1);
    expect(result.conflictCount).toBe(1);
  });

  it('keeps the canonical value while exposing a durable unresolved source conflict', () => {
    const conflicts = [{
      id: 'repair-cost-conflict',
      property_id: 'room-1',
      field_id: 'field-1',
      field_key: 'financial.repair_costs',
      display_label: 'Repair Costs',
      canonical_value: '$210,000',
      conflicting_value: '$225,000',
      canonical_source_doc_id: 'contractor-doc',
      conflicting_source_doc_id: 'invoice-doc',
      status: 'unresolved',
    }];
    const state = computeTransactionRecordState([{
      id: 'field-1',
      field_key: 'financial.repair_costs',
      display_label: 'Repair Costs',
      value_text: '$210,000',
      status: 'extracted',
      source_doc_id: 'contractor-doc',
    }], 'generic', null, conflicts);
    const readiness = computeTransactionReadiness(
      { workflow_pack_id: 'generic' },
      [{
        id: 'field-1',
        field_key: 'financial.repair_costs',
        display_label: 'Repair Costs',
        value_text: '$210,000',
        status: 'extracted',
        source_doc_id: 'contractor-doc',
      }],
      'generic',
      null,
      conflicts,
    );

    expect(state.fields.find(field => field.key === 'financial.repair_costs').value).toBe('$210,000');
    expect(state.unresolvedConflicts[0]).toEqual(expect.objectContaining({
      canonicalValue: '$210,000',
      conflictingValue: '$225,000',
      canonicalSourceDocId: 'contractor-doc',
      conflictingSourceDocId: 'invoice-doc',
    }));
    expect(state.unresolvedConflictCount).toBe(1);
    expect(readiness.hasBlockingConflicts).toBe(true);
    expect(readiness.approvalReady).toBe(false);
    expect(readiness.fundReleaseReady).toBe(false);
  });

  it('does not treat four generic transaction facts as sufficient digital-asset preparation', () => {
    const fields = [
      { field_key: 'transaction.type', value_text: 'Commercial acquisition', status: 'verified' },
      { field_key: 'transaction.jurisdiction', value_text: 'us_fl', status: 'verified' },
      { field_key: 'asset.name', value_text: 'Harbor View Apartments', status: 'verified' },
      { field_key: 'parties.buyer', value_text: 'Harbor View Capital', status: 'verified' },
    ];

    const result = computeTransactionReadiness(
      { workflow_pack_id: 'cre_acquisition' },
      fields,
      'cre_acquisition',
    );

    expect(result.digitalAssetSufficient).toBe(false);
    expect(result.digitalAssetGapCount).toBeGreaterThan(0);
    expect(result.digitalAssetRequiredInputCount).toBeGreaterThan(4);
  });
});