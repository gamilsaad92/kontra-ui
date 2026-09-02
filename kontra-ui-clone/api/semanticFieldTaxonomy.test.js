const {
  inferSemanticDefinition,
  semanticRecordKey,
  normalizeComparableValue,
  compareComparableValues,
  isSemanticallyValidValue,
} = require('./lib/semanticFieldTaxonomy');
const { normalizeProposal } = require('./lib/transactionRoomGenerator');
const { extractTransactionContext } = require('./lib/transactionRoomGenerator');
const { canonicalizeTransactionRecordKey } = require('./lib/transactionRecordCanonicalization');
const { extractFacts } = require('./lib/verificationEngine');

describe('semantic Transaction Record field taxonomy', () => {
  test.each([
    ['financial.reporting_period', 'Reporting Period', 'financial.reporting_period', 'period'],
    ['financial.certified_outstanding_principal', 'Certified Outstanding Principal', 'financial.outstanding_principal', 'amount'],
    ['financial.servicing_fee', 'Servicing Fee Rate', 'financial.servicing_fee_rate', 'percent'],
    ['financial.servicing_fee', 'Servicing Fee Amount', 'financial.servicing_fee_amount', 'amount'],
    ['document.references', 'References', 'legal.document_reference', 'reference'],
  ])('maps %s / %s to one typed semantic identity', (rawKey, label, recordKey, valueType) => {
    const definition = inferSemanticDefinition(rawKey, null, label);
    expect(definition).toEqual(expect.objectContaining({
      valueType,
      recordKey,
    }));
    expect(semanticRecordKey(rawKey, label)).toBe(recordKey);
  });

  test('does not conflict when a period frequency is paired with a covered interval', () => {
    const definition = inferSemanticDefinition('financial.reporting_period', null, 'Reporting Period');
    const comparison = compareComparableValues(
      normalizeComparableValue('monthly', definition),
      normalizeComparableValue('July 2026', definition),
      definition,
    );

    expect(comparison).toEqual({ comparable: false, equivalent: true });
  });

  test('keeps period metadata out of numeric cross-document verification', () => {
    expect(extractFacts({
      id: 'period-doc',
      section: 'servicing_statement',
      analysis: {
        metrics: {
          reporting_period: 'July 2026',
        },
      },
    })).toEqual([]);
  });

  test('keeps a genuine outstanding-principal discrepancy comparable', () => {
    const definition = inferSemanticDefinition(
      'financial.outstanding_principal',
      null,
      'Certified Outstanding Principal',
    );
    const comparison = compareComparableValues(
      normalizeComparableValue('$8,100,000', definition),
      normalizeComparableValue('$8,000,000', definition),
      definition,
    );

    expect(comparison).toEqual({ comparable: true, equivalent: false });
  });

  test('does not parse a facility identifier as certified principal', () => {
    const definition = inferSemanticDefinition(
      'financial.certified_outstanding_principal',
      null,
      'Certified Outstanding Principal',
    );
    const facility = normalizeComparableValue(
      'RRF 2026-1 Residential Transition Loan Facility',
      definition,
    );
    const amount = normalizeComparableValue('18,420', definition);

    expect(facility).toEqual({ type: 'text', value: 'rrf 2026 1 residential transition loan facility' });
    expect(isSemanticallyValidValue(
      'RRF 2026-1 Residential Transition Loan Facility',
      definition,
    )).toBe(false);
    expect(isSemanticallyValidValue('18,420', definition)).toBe(true);
    expect(compareComparableValues(facility, amount, definition))
      .toEqual({ comparable: false, equivalent: true });
    expect(extractFacts({
      id: 'facility-doc',
      section: 'compliance_documents',
      analysis: {
        metrics: {
          certified_outstanding_principal: 'RRF 2026-1 Residential Transition Loan Facility',
        },
      },
    })).toEqual([]);
  });

  test('normalizes generated proposal fields before they become persisted definitions', () => {
    const proposal = normalizeProposal({
      transaction: { title: 'Servicing review', category: 'cre_acquisition' },
      stages: [
        { key: 'review', name: 'Review' },
        { key: 'complete', name: 'Complete' },
      ],
      participants: [{ role: 'coordinator', label: 'Coordinator' }],
      transaction_record_fields: [
        { key: 'financial.servicing_fee', label: 'Servicing Fee Rate', value: '0.25%' },
        { key: 'financial.servicing_fee', label: 'Servicing Fee Amount', value: '$1,200' },
        { key: 'document.references', label: 'References', value: 'Loan Agreement.pdf' },
      ],
    });

    expect(proposal.transaction_record_fields.map(field => field.key)).toEqual([
      'financial.servicing_fee_rate',
      'financial.servicing_fee_amount',
      'legal.document_reference',
    ]);
  });

  test('keeps rate, amount, and document references out of one shared amount bucket', () => {
    const rate = inferSemanticDefinition('financial.servicing_fee', null, 'Servicing Fee Rate');
    const amount = inferSemanticDefinition('financial.servicing_fee', null, 'Servicing Fee Amount');
    const inferredRate = inferSemanticDefinition('financial.servicing_fee', '0.25%', '');
    const inferredAmount = inferSemanticDefinition('financial.servicing_fee', '$1,200', '');
    const reference = inferSemanticDefinition('document.references', null, 'References');

    expect(rate.recordKey).not.toBe(amount.recordKey);
    expect(rate.valueType).not.toBe(amount.valueType);
    expect(inferredRate.recordKey).toBe(rate.recordKey);
    expect(inferredAmount.recordKey).toBe(amount.recordKey);
    expect(reference.comparisonMode).toBe('none');
    expect(compareComparableValues(
      normalizeComparableValue('Loan Agreement.pdf', reference),
      normalizeComparableValue('Servicing Statement.pdf', reference),
      reference,
    )).toEqual({ comparable: false, equivalent: true });
  });

  test('keeps policy limits distinct from repair costs', () => {
    const policy = inferSemanticDefinition('insurance.policy_limit', '$2.5M', 'Policy limit');
    const repair = inferSemanticDefinition('financial.repair_costs', '$96,480', 'Repair costs');

    expect(policy).toEqual(expect.objectContaining({
      recordKey: 'financial.policy_limit',
      valueType: 'amount',
    }));
    expect(repair).toEqual(expect.objectContaining({
      recordKey: 'financial.repair_costs',
      valueType: 'amount',
    }));
    expect(policy.comparisonKey).not.toBe(repair.comparisonKey);
  });

  test('does not infer borrower funds from an unrelated approximate amount', () => {
    expect(extractTransactionContext(
      'The policy limit is approximately $2.5M and estimated repair costs are $96,480.',
    )).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'financial.borrower_funds_advanced' }),
    ]));
  });

  test('canonicalizes property and borrower address aliases independently', () => {
    expect(canonicalizeTransactionRecordKey('property.property_address')).toBe('asset.address');
    expect(canonicalizeTransactionRecordKey('borrower.address')).toBe('parties.borrower_address');
    expect(canonicalizeTransactionRecordKey('property.property_address'))
      .not.toBe(canonicalizeTransactionRecordKey('borrower.address'));
  });
});