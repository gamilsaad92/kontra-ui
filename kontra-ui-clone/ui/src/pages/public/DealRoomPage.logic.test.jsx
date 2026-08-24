const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const {
  getLifecycleAdvanceRecommendation,
  getNextMilestoneBlockers,
  getOpenIssueCount,
  hasDocumentReviewFinding,
  getDocumentRequirementStats,
  filterLiveDocumentActions,
  dedupeAttentionItems,
  getCoordinatorRecordFacts,
  getRecordDefinitionState,
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

  test('uses active analyses as the live checklist document state', () => {
    const labels = [
      'Contractor Agreement',
      'Insurance Claim Documentation',
      'Repair Invoices',
      'Proof of Payment',
      'Lien Waivers',
      'Repair Progress Report',
    ];
    const checklistItems = labels.map((label, index) => ({
      id: `doc-${index}`,
      section: label.toLowerCase().replaceAll(' ', '_'),
      label,
      required: true,
      status: 'missing',
      uploaded: false,
    }));
    const analyses = checklistItems.map((item, index) => ({
      id: `analysis-${index}`,
      section: item.section,
      filename: `${item.label}.pdf`,
      processing_status: 'complete',
      analysis: index === 1 ? { discrepancies: ['Claim amount needs review'] } : { summary: 'Received' },
    }));
    const stats = getDocumentRequirementStats(checklistItems, null, {}, analyses);

    expect(stats.receivedDocuments).toHaveLength(6);
    expect(stats.missingDocuments).toHaveLength(0);
    expect(stats.reviewDocuments.map(item => item.label)).toEqual(['Insurance Claim Documentation']);
    expect(filterLiveDocumentActions([
      { title: 'Request Contractor Agreement', document: true },
      { title: 'Request Insurance Claim Documentation', document: true },
      { title: 'Request a missing title report', document: true },
    ], stats).map(item => item.title)).toEqual(['Request a missing title report']);
  });

  test('deduplicates repeated repair discrepancy actions without removing other actions', () => {
    expect(dedupeAttentionItems([
      { title: 'Resolve Repair Cost Discrepancy' },
      { title: 'Repair Costs' },
      { title: 'Resolve Insurance Proceeds Discrepancy' },
    ]).map(item => item.title)).toEqual([
      'Resolve Repair Cost Discrepancy',
      'Resolve Insurance Proceeds Discrepancy',
    ]);
  });
});