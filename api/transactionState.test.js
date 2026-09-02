const {
  computeTransactionReadiness,
  computeTransactionRecordState,
  getHazardLossRepairGate,
  isImmediateLifecycleAdvance,
  latestEvidenceTimestamp,
  shouldPreserveResolvedConflict,
  isConflictSupportedByActiveEvidence,
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

  it('uses canonical aliases and persisted value fields when checking the hazard gate', () => {
    const legacyState = {
      schemaKey: 'generated_ai',
      recordState: {
        fields: [],
        requiredFields: [
          { key: 'financial.repair_costs', value: '$229,950', status: 'confirmed' },
        ],
        unresolvedConflictCount: 0,
      },
      recordFields: [
        { field_key: 'hazard.incident_date', value_text: '2026-07-10', status: 'verified' },
        { field_key: 'hazard.insurance_proceeds', value_text: '$325,000', status: 'verified' },
      ],
    };
    expect(getHazardLossRepairGate(legacyState)).toEqual({
      ok: true,
      unmetFields: [],
      unresolvedConflicts: 0,
    });
  });

  it('falls back to the visible hazard labels for legacy field identities', () => {
    const labelState = {
      recordState: {
        fields: [
          { key: 'legacy_date', label: 'Incident Date', value: '2026-07-10', status: 'confirmed' },
          { key: 'legacy_proceeds', label: 'Insurance Proceeds', value: '$325,000', status: 'confirmed' },
          { key: 'legacy_costs', label: 'Repair Costs', value: '$229,950', status: 'confirmed' },
        ],
        unresolvedConflictCount: 0,
      },
    };
    expect(getHazardLossRepairGate(labelState)).toEqual({
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

  it('normalizes every populated unconfirmed value to awaiting confirmation', () => {
    const result = computeTransactionRecordState([
      { field_key: 'asset.property_type', display_label: 'Property Type', value_text: 'Multifamily', status: 'captured' },
      { field_key: 'transaction.loss_event', display_label: 'Loss Event', value_text: 'Water-line rupture', status: 'extracted' },
      { field_key: 'financial.insurance_proceeds_control', display_label: 'Insurance Proceeds Control', value_text: null, status: 'missing' },
    ], 'generated_ai', [
      { key: 'asset.property_type', label: 'Property Type', required: true },
      { key: 'transaction.loss_event', label: 'Loss Event', required: true },
      { key: 'financial.insurance_proceeds_control', label: 'Insurance Proceeds Control', required: true },
    ]);

    expect(result.requiredFields).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Property Type', value: 'Multifamily', status: 'awaiting' }),
      expect.objectContaining({ label: 'Loss Event', value: 'Water-line rupture', status: 'awaiting' }),
      expect.objectContaining({ label: 'Insurance Proceeds Control', status: 'missing', value: null }),
    ]));
    expect(result.confirmedCount).toBe(0);
    expect(result.awaitingRequiredCount).toBe(2);
    expect(result.missingRequiredCount).toBe(1);
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

  it('retires threshold, unrelated, and superseded evidence conflicts from live state', () => {
    const documents = [
      {
        id: 'policy',
        section: 'servicing_policy',
        is_active: true,
        analysis: { metrics: { delinquency_trigger: { value: 7.5, unit: '%' } } },
      },
      {
        id: 'servicer',
        section: 'servicer_report',
        is_active: true,
        analysis: { metrics: { actual_delinquency: { value: 8.1, unit: '%' } } },
      },
      {
        id: 'commitment',
        section: 'loan_commitment',
        is_active: true,
        analysis: { metrics: { total_commitment: '$25,000,000' } },
      },
      {
        id: 'old-noi',
        section: 'operating_statement',
        is_active: false,
        superseded_at: '2026-08-20T00:00:00.000Z',
        analysis: { metrics: { net_operating_income: '$6,000,000' } },
      },
    ];

    expect(isConflictSupportedByActiveEvidence({
      field_key: 'covenant.delinquency_rate',
      display_label: 'Delinquency Rate',
      canonical_source_doc_id: 'policy',
      conflicting_source_doc_id: 'servicer',
    }, documents)).toBe(false);
    expect(isConflictSupportedByActiveEvidence({
      field_key: 'financial.noi',
      display_label: 'Net Operating Income',
      canonical_source_doc_id: 'commitment',
      conflicting_source_doc_id: 'servicer',
    }, documents)).toBe(false);
    expect(isConflictSupportedByActiveEvidence({
      field_key: 'financial.noi',
      display_label: 'Net Operating Income',
      canonical_source_doc_id: 'old-noi',
      conflicting_source_doc_id: 'servicer',
    }, documents)).toBe(false);
  });

  it.each([
    ['financial.reporting_period', 'Reporting Period', 'monthly', 'July 2026'],
    ['legal.document_reference', 'References', 'Loan Agreement.pdf', 'Servicing Statement.pdf'],
  ])('does not preserve a non-conflicting %s comparison during hydration', (fieldKey, label, canonicalValue, conflictingValue) => {
    expect(isConflictSupportedByActiveEvidence({
      field_key: fieldKey,
      display_label: label,
      canonical_value: canonicalValue,
      conflicting_value: conflictingValue,
    }, [])).toBe(false);
  });

  it('preserves a genuine typed outstanding-principal discrepancy', () => {
    expect(isConflictSupportedByActiveEvidence({
      field_key: 'financial.outstanding_principal',
      display_label: 'Certified Outstanding Principal',
      canonical_value: '$8,100,000',
      conflicting_value: '$8,000,000',
    }, [])).toBe(true);
  });

  it('retires the facility-identifier versus principal conflict automatically', () => {
    expect(isConflictSupportedByActiveEvidence({
      field_key: 'financial.certified_outstanding_principal',
      display_label: 'Certified Outstanding Principal',
      canonical_value: 'RRF 2026-1 Residential Transition Loan Facility',
      conflicting_value: '18,420',
      canonical_source_doc_id: 'rrf-facility-document',
      conflicting_source_doc_id: '06_compliance_documents',
    }, [
      { id: 'rrf-facility-document', is_active: true },
      { id: '06_compliance_documents', is_active: true },
    ])).toBe(false);
  });

  it('projects a field-only conflict into the canonical unresolved conflict list', () => {
    const state = computeTransactionRecordState([{
      id: 'reporting-period-field',
      field_key: 'financial.reporting_period',
      display_label: 'Reporting Period',
      value_text: '2025',
      status: 'conflicting',
      conflict_candidates: [{ value: '2024', source_doc_id: 'annual-report' }],
    }], 'generic', null, []);

    expect(state.unresolvedConflicts).toEqual([expect.objectContaining({
      fieldKey: 'financial.reporting_period',
      canonicalValue: '2025',
      conflictingValue: '2024',
    })]);
    expect(state.unresolvedConflictCount).toBe(1);
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