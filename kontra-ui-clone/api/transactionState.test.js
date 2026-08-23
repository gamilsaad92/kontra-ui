const {
  computeTransactionReadiness,
  computeTransactionRecordState,
  getHazardLossRepairGate,
  isImmediateLifecycleAdvance,
  latestEvidenceTimestamp,
  shouldPreserveResolvedConflict,
} = require('./lib/transactionState');

const requirements = require('../shared/transaction_record_requirements.json');
const {
  canonicalizeTransactionRecordKey,
  aliasKeysForCanonical,
} = require('./lib/transactionRecordCanonicalization');

describe('transaction state recalculation', () => {
  it('accepts only the next persisted lifecycle stage, plus legacy funded settlement migration', () => {
    const stages = [
      { key: 'claim_review' },
      { key: 'repair_progress' },
      { key: 'funds_release' },
    ];
    expect(isImmediateLifecycleAdvance(stages, 'claim_review', 'repair_progress')).toBe(true);
    expect(isImmediateLifecycleAdvance(stages, 'claim_review', 'funds_release')).toBe(false);
    expect(isImmediateLifecycleAdvance(stages, 'repair_progress', 'claim_review')).toBe(false);
    expect(isImmediateLifecycleAdvance(stages, 'funded', 'settlement')).toBe(true);
  });

  it('blocks hazard-loss repair advancement until all canonical facts are confirmed', () => {
    const awaitingState = {
      recordState: {
        fields: [
          { key: 'transaction.incident_date', value: '2026-07-10', status: 'awaiting' },
          { key: 'financial.insurance_proceeds', value: '$325,000', status: 'awaiting' },
          { key: 'financial.repair_costs', value: '$229,950', status: 'confirmed' },
        ],
        unresolvedConflictCount: 0,
      },
    };
    expect(getHazardLossRepairGate(awaitingState)).toEqual({
      ok: false,
      unmetFields: ['transaction.incident_date', 'financial.insurance_proceeds'],
      unresolvedConflicts: 0,
    });

    const confirmedState = {
      recordState: {
        fields: [
          { key: 'transaction.incident_date', value: '2026-07-10', status: 'confirmed' },
          { key: 'financial.insurance_proceeds', value: '$325,000', status: 'confirmed' },
          { key: 'financial.repair_costs', value: '$229,950', status: 'confirmed' },
        ],
        unresolvedConflictCount: 0,
      },
    };
    expect(getHazardLossRepairGate(confirmedState)).toEqual({
      ok: true,
      unmetFields: [],
      unresolvedConflicts: 0,
    });
  });

  it.each([
    ['hazard.incident_date', 'transaction.incident_date'],
    ['transaction.incident_date', 'transaction.incident_date'],
    ['hazard.insurance_proceeds', 'financial.insurance_proceeds'],
    ['insurance.proceeds', 'financial.insurance_proceeds'],
    ['financial.insurance_proceeds', 'financial.insurance_proceeds'],
    ['hazard.repair_costs', 'financial.repair_costs'],
    ['asset.units_affected', 'asset.units_damaged'],
  ])('resolves %s to one canonical identity', (alias, canonical) => {
    expect(canonicalizeTransactionRecordKey(alias, 'generated_ai')).toBe(canonical);
    expect(aliasKeysForCanonical(canonical, 'generated_ai')).toContain(alias);
  });

  it('counts extracted hazard aliases against generated required definitions', () => {
    const readiness = computeTransactionReadiness(
      { workflow_pack_id: 'generated_ai' },
      [
        {
          id: 'incident-date',
          field_key: 'transaction.incident_date',
          field_category: 'legal',
          display_label: 'Incident Date',
          value_text: '2026-07-10',
          status: 'verified',
        },
        {
          id: 'insurance-proceeds',
          field_key: 'insurance.proceeds',
          field_category: 'insurance',
          display_label: 'Insurance Proceeds',
          value_text: '$325,000',
          status: 'extracted',
        },
      ],
      'generated_ai',
      [
        { key: 'hazard.incident_date', label: 'Incident Date', required: true, category: 'hazard' },
        { key: 'hazard.insurance_proceeds', label: 'Insurance Proceeds', required: true, category: 'hazard' },
      ],
      [],
    );

    expect(readiness.recordState.requiredFields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        definitionKey: 'hazard.incident_date',
        key: 'transaction.incident_date',
        category: 'transaction',
        value: '2026-07-10',
        status: 'confirmed',
      }),
      expect.objectContaining({
        definitionKey: 'hazard.insurance_proceeds',
        key: 'financial.insurance_proceeds',
        category: 'financial',
        value: '$325,000',
        status: 'awaiting',
      }),
    ]));
    expect(readiness.confirmedCount).toBe(1);
    expect(readiness.requiredCount).toBe(2);
    expect(readiness.overall).toBe(50);
  });

  it('maps every populated unconfirmed value to awaiting without changing the required denominator', () => {
    const result = computeTransactionRecordState([
      { field_key: 'transaction.incident_date', value_text: '2026-07-10', status: 'needs_review' },
      { field_key: 'financial.insurance_proceeds', value_text: '$325,000', status: 'extracted' },
      { field_key: 'financial.borrower_funds_advanced', value_text: '$40,000', status: 'captured' },
      { field_key: 'financial.contractor_proposal_amount', value_text: '$229,950', status: 'manual' },
      { field_key: 'asset.type', value_text: 'Multifamily', status: 'generated' },
      { field_key: 'transaction.loss_type', value_text: 'Fire', status: 'generated' },
      { field_key: 'transaction.loss_event', value_text: 'Hurricane', status: 'generated' },
      { field_key: 'transaction.expected_completion_date', value_text: '2026-12-01', status: 'generated' },
      { field_key: 'financial.repair_costs', value_text: '$229,950', status: 'verified' },
    ], 'generated_ai', [
      { key: 'transaction.incident_date', label: 'Incident Date', required: true },
      { key: 'financial.insurance_proceeds', label: 'Insurance Proceeds', required: true },
      { key: 'financial.borrower_funds_advanced', label: 'Borrower Funds Advanced', required: true },
      { key: 'financial.contractor_proposal_amount', label: 'Contractor Proposal Amount', required: true },
      { key: 'asset.type', label: 'Property Type', required: true },
      { key: 'transaction.loss_type', label: 'Loss Type', required: true },
      { key: 'transaction.loss_event', label: 'Loss Event', required: true },
      { key: 'transaction.expected_completion_date', label: 'Expected Completion Date', required: true },
      { key: 'financial.repair_costs', label: 'Repair Costs', required: true },
    ]);

    expect(result.requiredFields.filter(field => field.status === 'awaiting')).toHaveLength(8);
    expect(result.requiredFields.filter(field => field.status === 'missing')).toHaveLength(0);
    expect(result.confirmedCount).toBe(1);
    expect(result.awaitingRequiredCount).toBe(8);
    expect(result.requiredCount).toBe(9);
  });

  it('treats a cleared JSON-backed candidate as missing after the canonical refresh', () => {
    const definition = [{ key: 'insurance.claim_details', label: 'Insurance Claim Details', required: true }];
    const awaiting = computeTransactionRecordState([
      {
        id: 'claim-details',
        field_key: 'insurance.claim_details',
        value_text: '',
        value_json: { status: 'Acknowledged' },
        status: 'needs_review',
      },
    ], 'generated_ai', definition);
    const cleared = computeTransactionRecordState([
      {
        id: 'claim-details',
        field_key: 'insurance.claim_details',
        value_text: '',
        value_json: null,
        status: 'missing',
      },
    ], 'generated_ai', definition);

    expect(awaiting.requiredFields[0]).toEqual(expect.objectContaining({ status: 'awaiting' }));
    expect(cleared.requiredFields[0]).toEqual(expect.objectContaining({ status: 'missing' }));
    expect(cleared.awaitingRequiredCount).toBe(0);
    expect(cleared.confirmedCount).toBe(0);
  });

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

  it('does not reopen a resolved conflict during a read-after-write refresh', () => {
    expect(shouldPreserveResolvedConflict({
      fieldKey: 'financial.repair_costs',
      latestEvidenceAt: '2026-08-20T12:00:00.000Z',
      resolvedConflicts: [{
        field_key: 'financial.repair_costs',
        status: 'resolved',
        resolved_at: '2026-08-20T12:01:00.000Z',
      }],
    })).toBe(true);

    expect(shouldPreserveResolvedConflict({
      fieldKey: 'financial.repair_costs',
      latestEvidenceAt: '2026-08-21T12:00:00.000Z',
      resolvedConflicts: [{
        field_key: 'financial.repair_costs',
        status: 'resolved',
        resolved_at: '2026-08-20T12:01:00.000Z',
      }],
    })).toBe(false);
  });

  it('uses only field-relevant evidence when deciding whether a resolution is stale', () => {
    expect(latestEvidenceTimestamp([
      { document: { section: 'repair_invoices', created_at: '2026-08-20T12:00:00.000Z' } },
      { document: { section: 'title', created_at: '2026-08-21T12:00:00.000Z' } },
    ])).toBe('2026-08-21T12:00:00.000Z');

    // The reconciliation caller supplies candidates only from the field's
    // relevant evidence. An unrelated later document is therefore absent.
    expect(latestEvidenceTimestamp([
      { document: { section: 'repair_invoices', created_at: '2026-08-20T12:00:00.000Z' } },
    ])).toBe('2026-08-20T12:00:00.000Z');
  });

  it('treats a resolved canonical field as confirmed after a fresh state read', () => {
    const fields = [{
      id: 'repair-cost-field',
      field_key: 'financial.repair_costs',
      display_label: 'Repair Costs',
      value_text: '$229,950',
      status: 'verified',
    }];
    const readiness = computeTransactionReadiness(
      { workflow_pack_id: 'generic' },
      fields,
      'generic',
      [{ key: 'financial.repair_costs', label: 'Repair Costs' }],
      [],
    );

    expect(readiness.recordState.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'financial.repair_costs',
        value: '$229,950',
        status: 'confirmed',
      }),
    ]));
    expect(readiness.unresolvedConflictCount).toBe(0);
  });

  it.each([
    ['$210,000', 'contractor-doc'],
    ['$225,000', 'invoice-doc'],
  ])('keeps either selected conflict value confirmed across a fresh state read (%s)', (selectedValue, selectedSource) => {
    const fields = [{
      id: 'repair-cost-field',
      field_key: 'financial.repair_costs',
      display_label: 'Repair Costs',
      value_text: selectedValue,
      status: 'verified',
      source_doc_id: selectedSource,
    }];
    const readiness = computeTransactionReadiness(
      { workflow_pack_id: 'generic' },
      fields,
      'generic',
      [{ key: 'financial.repair_costs', label: 'Repair Costs' }],
      [],
    );

    expect(readiness.recordState.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'financial.repair_costs',
        value: selectedValue,
        status: 'confirmed',
      }),
    ]));
    expect(readiness.confirmedCount).toBe(1);
    expect(readiness.unresolvedConflictCount).toBe(0);
  });

  it('keeps a newer extraction as a source conflict without replacing the confirmed canonical value', () => {
    const readiness = computeTransactionReadiness(
      { workflow_pack_id: 'generic' },
      [{
        id: 'field-1',
        field_key: 'financial.repair_costs',
        display_label: 'Repair Costs',
        value_text: '$210,000',
        status: 'source_changed',
        source_doc_id: 'contractor-doc',
      }],
      'generic',
      [{ key: 'financial.repair_costs', label: 'Repair Costs' }],
      [{
        id: 'new-conflict',
        field_id: 'field-1',
        field_key: 'financial.repair_costs',
        display_label: 'Repair Costs',
        canonical_value: '$210,000',
        conflicting_value: '$225,000',
        status: 'unresolved',
      }],
    );

    expect(readiness.recordState.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: '$210,000', status: 'confirmed', attention: 'source_changed' }),
    ]));
    expect(readiness.recordState.unresolvedConflictCount).toBe(1);
    expect(readiness.confirmedCount).toBe(1);
    expect(readiness.hasBlockingConflicts).toBe(true);
  });

  it('matches a persisted required field by its unique generated label when keys differ', () => {
    const readiness = computeTransactionReadiness(
      { workflow_pack_id: 'generated_ai' },
      [{
        id: 'repair-cost-field',
        field_key: 'financial.repair_costs',
        display_label: 'Repair Costs',
        value_text: '$229,950',
        status: 'verified',
      }],
      'generated_ai',
      [{ key: 'transaction.repairs_total', label: 'Repair Costs' }],
      [],
    );

    expect(readiness.confirmedCount).toBe(1);
    expect(readiness.requiredCount).toBe(1);
    expect(readiness.overall).toBe(100);
    expect(readiness.recordState.requiredFields[0]).toEqual(expect.objectContaining({
      value: '$229,950',
      status: 'confirmed',
      definitionKey: 'transaction.repairs_total',
      persistedKey: 'financial.repair_costs',
    }));
  });

  it('keeps generated category and field identity on the same authoritative state row', () => {
    const readiness = computeTransactionReadiness(
      { workflow_pack_id: 'generated_ai' },
      [{
        id: 'incident-date-field',
        field_key: 'transaction.incident_date',
        field_category: 'legal',
        display_label: 'Incident Date',
        value_text: '2026-08-01',
        status: 'verified',
      }, {
        id: 'repair-cost-field',
        field_key: 'financial.repair_costs',
        field_category: 'financial',
        display_label: 'Repair Costs',
        value_text: '$210,000',
        status: 'verified',
      }],
      'generated_ai',
      [
        { key: 'hazard.incident_date', label: 'Incident Date' },
        { key: 'hazard.repair_costs', label: 'Repair Costs' },
        { key: 'hazard.open_issues', label: 'Open Issues' },
      ],
      [],
    );

    expect(readiness.recordState.requiredFields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        definitionKey: 'hazard.incident_date',
        persistedKey: 'transaction.incident_date',
        category: 'transaction',
        status: 'confirmed',
      }),
      expect.objectContaining({
        definitionKey: 'hazard.repair_costs',
        persistedKey: 'financial.repair_costs',
        category: 'financial',
        status: 'confirmed',
      }),
    ]));
    expect(readiness.confirmedCount).toBe(2);
    expect(readiness.requiredCount).toBe(3);
    expect(readiness.overall).toBe(67);
  });

  it('keeps a legacy hazard-loss snapshot coherent across categories and confirmation states', () => {
    const readiness = computeTransactionReadiness(
      { workflow_pack_id: 'generated_ai' },
      [
        { id: 'repair', field_key: 'financial.repair_costs', field_category: 'repairs', display_label: 'Repair Costs', value_text: '$229,950', status: 'verified' },
        { id: 'incident', field_key: 'transaction.incident_date', field_category: 'incident', display_label: 'Incident Date', value_text: '2026-07-14', status: 'needs_review' },
        { id: 'proceeds', field_key: 'insurance.proceeds', field_category: 'insurance', display_label: 'Insurance Proceeds', value_text: '$300,000', status: 'extracted' },
        { id: 'proof', field_key: 'legal.proof_of_payment', field_category: 'documents', display_label: 'Proof of Payment', value_text: 'Uploaded', status: 'needs_review' },
        { id: 'lien', field_key: 'legal.lien_waivers', field_category: 'legal', display_label: 'Lien Waivers', value_text: 'Uploaded', status: 'needs_review' },
      ],
      'generated_ai',
      [
        { key: 'hazard.repair_costs', label: 'Repair Costs' },
        { key: 'hazard.incident_date', label: 'Incident Date' },
        { key: 'hazard.insurance_proceeds', label: 'Insurance Proceeds' },
        { key: 'hazard.proof_of_payment', label: 'Proof of Payment' },
        { key: 'hazard.lien_waivers', label: 'Lien Waivers' },
      ],
      [],
    );

    expect(readiness.recordState.requiredCount).toBe(5);
    expect(readiness.recordState.confirmedCount).toBe(1);
    expect(readiness.recordState.awaitingRequiredCount).toBe(4);
    expect(readiness.recordState.requiredFields).toEqual(expect.arrayContaining([
      expect.objectContaining({ definitionKey: 'hazard.repair_costs', persistedKey: 'financial.repair_costs', status: 'confirmed', category: 'financial' }),
      expect.objectContaining({ definitionKey: 'hazard.incident_date', persistedKey: 'transaction.incident_date', status: 'awaiting', category: 'transaction' }),
    ]));
    expect(readiness.overall).toBe(20);
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