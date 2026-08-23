const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const {
  getLifecycleAdvanceRecommendation,
  getNextMilestoneBlockers,
  getOpenIssueCount,
  hasDocumentReviewFinding,
  getCoordinatorRecordFacts,
  getRecordDefinitionState,
  normalizedRecordStatus,
} = require('./DealRoomPage');

describe('coordinator transaction brief logic', () => {
  const stages = [
    { key: 'under_review', label: 'Under Review' },
    { key: 'approved', label: 'Approved' },
  ];

  test('suppresses the Approved recommendation when a blocking conflict exists', () => {
    const analyses = [{ section: 'loi', processing_status: 'complete', analysis: { summary: 'Executed' } }];

    expect(getLifecycleAdvanceRecommendation(stages, 0, analyses, false)).toEqual(
      expect.objectContaining({ stage: expect.objectContaining({ key: 'approved' }) })
    );
    expect(getLifecycleAdvanceRecommendation(stages, 0, analyses, true)).toBeNull();
  });

  test('counts conflicts as open issues even when there are no checklist blockers', () => {
    expect(getOpenIssueCount([{ key: 'legal.title_status' }], [])).toBe(1);
    expect(getOpenIssueCount([], [{ key: 'next-doc-purchase_agreement' }])).toBe(1);
    expect(getOpenIssueCount([], [], 2)).toBe(2);
  });

  test('adds a required participant blocker tied to the next milestone', () => {
    const result = getNextMilestoneBlockers({
      stages: [
        { key: 'under_review', label: 'Under Review' },
        { key: 'approved', label: 'Approved', requiredRoles: ['buyer'] },
      ],
      currentStageIndex: 0,
      checklistItems: [],
      analyses: [],
      participantStates: [{ key: 'buyer', label: 'Buyer', required: true, joined: false }],
    });

    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'next-participant-buyer' }),
    ]));
  });

  test('keeps a confirmed generated field beyond the initial facts slice visible', () => {
    const definitions = Array.from({ length: 9 }, (_, index) => ({
      key: `transaction.fact_${index + 1}`,
      label: `Fact ${index + 1}`,
      required: true,
    }));
    const property = {
      generated_proposal: {
        transaction_record_fields: definitions,
      },
    };
    const recordState = {
      fields: definitions.map((definition, index) => ({
        key: definition.key,
        label: definition.label,
        value: index === 8 ? 'Confirmed value' : '',
        status: index === 8 ? 'confirmed' : 'missing',
      })),
    };

    expect(getCoordinatorRecordFacts('generated_ai', property, [], recordState))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: 'transaction.fact_9',
          value: 'Confirmed value',
          status: 'confirmed',
        }),
      ]));
  });

  test('maps a confirmed generated field through its persisted legacy key', () => {
    const property = {
      generated_proposal: {
        transaction_record_fields: [
          { key: 'hazard.repair_costs', label: 'Repair Costs', required: true, category: 'hazard' },
          { key: 'hazard.incident_date', label: 'Incident Date', required: true, category: 'incident' },
        ],
      },
    };
    const recordState = {
      fields: [
        {
          key: 'financial.repair_costs',
          persistedKey: 'financial.repair_costs',
          label: 'Repair Costs',
          value: '$210,000',
          status: 'confirmed',
        },
      ],
      requiredFields: [
        {
          key: 'financial.repair_costs',
          definitionKey: 'hazard.repair_costs',
          persistedKey: 'financial.repair_costs',
          label: 'Repair Costs',
          value: '$210,000',
          status: 'confirmed',
        },
        {
          key: 'hazard.incident_date',
          definitionKey: 'hazard.incident_date',
          label: 'Incident Date',
          value: '',
          status: 'awaiting',
        },
      ],
    };

    expect(getCoordinatorRecordFacts('generated_ai', property, [], recordState))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: 'hazard.repair_costs',
          label: 'Repair Costs',
          value: '$210,000',
          status: 'confirmed',
        }),
      ]));
  });

  test('keeps a populated awaiting generated field out of the missing state', () => {
    const result = getRecordDefinitionState(
      { key: 'hazard.incident_date', label: 'Incident Date', category: 'incident' },
      [{
        field_key: 'transaction.incident_date',
        display_label: 'Incident Date',
        value_text: '2026-07-10',
        status: 'extracted',
      }],
      null,
    );

    expect(result).toEqual(expect.objectContaining({
      value: '2026-07-10',
      status: 'awaiting',
    }));
  });

  test('promotes a populated unconfirmed fallback field to awaiting confirmation', () => {
    expect(normalizedRecordStatus({
      value_text: 'Fire',
      status: 'generated',
    })).toBe('awaiting');
    expect(getRecordDefinitionState(
      { key: 'hazard.loss_type', label: 'Loss Type' },
      [{ field_key: 'hazard.loss_type', value_text: 'Fire', status: 'generated' }],
      null,
    )).toEqual(expect.objectContaining({ value: 'Fire', status: 'awaiting' }));
  });

  test('keeps canonical refresh values awaiting across every hazard fact projection', () => {
    const definitions = [
      ['insurance.claim_status', 'Insurance Claim Status', 'Acknowledged'],
      ['insurance.proceeds_control', 'Insurance Proceeds Control', 'Held or controlled by servicer'],
      ['financial.funding_request', 'Funding Request', 'Reimbursement and/or additional repair proceeds'],
      ['asset.type', 'Property Type', 'Multifamily'],
      ['transaction.loss_type', 'Loss Type', 'Hazard loss'],
      ['transaction.loss_event', 'Loss Event', 'Fire'],
      ['asset.units_damaged', 'Units Damaged', '18'],
      ['financial.repair_costs', 'Repair Costs', '$229,950'],
    ].map(([key, label, value]) => ({ key, label, value, required: true, category: key.split('.')[0] }));
    const property = { generated_proposal: { transaction_record_fields: definitions } };
    const recordState = {
      fields: definitions.map((definition, index) => ({
        key: definition.key,
        persistedKey: definition.key,
        definitionKey: definition.key,
        label: definition.label,
        value: definition.value,
        status: index === definitions.length - 1 ? 'confirmed' : 'awaiting',
      })),
    };

    const facts = getCoordinatorRecordFacts('generated_ai', property, [], recordState);
    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Insurance Claim Status',
        value: 'Acknowledged',
        status: 'awaiting',
      }),
      expect.objectContaining({
        label: 'Loss Event',
        value: 'Fire',
        status: 'awaiting',
      }),
      expect.objectContaining({
        label: 'Repair Costs',
        value: '$229,950',
        status: 'confirmed',
      }),
    ]));
    expect(getRecordDefinitionState(definitions[0], [], recordState))
      .toEqual(expect.objectContaining({ value: 'Acknowledged', status: 'awaiting' }));
  });

  test('keeps the durable field identity through confirmation and refresh for insurance claim status', () => {
    const definition = {
      key: 'insurance.claim_status',
      canonicalKey: 'insurance.claim_status',
      label: 'Insurance Claim Status',
      required: true,
      category: 'financial',
    };
    const awaitingState = {
      requiredFields: [{
        fieldId: 'claim-status-field',
        key: 'insurance.claim_status',
        persistedKey: 'insurance.claim_status',
        definitionKey: 'insurance.claim_status',
        label: 'Insurance Claim Status',
        value: 'Acknowledged',
        status: 'awaiting',
      }],
    };
    const confirmedState = {
      requiredFields: [{
        ...awaitingState.requiredFields[0],
        status: 'confirmed',
      }],
    };

    expect(getRecordDefinitionState(definition, [], awaitingState)).toEqual(expect.objectContaining({
      fieldId: 'claim-status-field',
      value: 'Acknowledged',
      status: 'awaiting',
    }));
    expect(getRecordDefinitionState(definition, [], confirmedState)).toEqual(expect.objectContaining({
      fieldId: 'claim-status-field',
      value: 'Acknowledged',
      status: 'confirmed',
    }));
  });

  test('recognizes document findings without treating them as record conflicts', () => {
    expect(hasDocumentReviewFinding({
      section: 'proof_of_payment',
      analysis: { paymentDiscrepancies: [{ issue: 'Amount differs' }] },
    })).toBe(true);
    expect(hasDocumentReviewFinding({
      section: 'lien_waivers',
      analysis: { status: 'complete' },
    })).toBe(false);
  });
});