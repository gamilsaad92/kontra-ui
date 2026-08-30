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
  filterStaleRecordActions,
  actionTextMentionsRecordField,
  isBorrowerFundsRecordAction,
  getHazardLossOperationalFieldDefinitions,
  dedupeAttentionItems,
  getCanonicalAwaitingRecordFields,
  getCanonicalUnresolvedConflicts,
  getCoordinatorRecordFacts,
  getRecordDefinitionState,
  mergeTransactionRecordState,
  normalizeRecordCategory,
  getTransactionRecordCategory,
  getRecordActionTarget,
  getCurrentProvenanceGap,
  preparationDraftValue,
  preparationSaveConfirmation,
  preparationPdfConfirmation,
  findPreparationPdfArtifact,
} = require('./DealRoomPage');

describe('coordinator transaction brief logic', () => {
  const stages = [
    { key: 'under_review', label: 'Under Review' },
    { key: 'approved', label: 'Approved' },
  ];

  test('keeps inherited structured preparation values editable without flattening them', () => {
    expect(preparationDraftValue({
      input_type: 'choice_with_detail',
      value: { choice: 'other', detail: 'Texas, United States' },
    })).toEqual({ choice: 'other', detail: 'Texas, United States' });
    expect(preparationDraftValue({
      input_type: 'multi_choice_with_detail',
      value: { choices: ['qualified_investors'], detail: 'Review with counsel' },
    })).toEqual({
      choices: ['qualified_investors'],
      detail: 'Review with counsel',
    });
  });

  test('makes a successful preparation save visible and names the revision', () => {
    expect(preparationSaveConfirmation({
      revision: 2,
      packageStatus: 'ready_for_provider_review',
    })).toBe('Saved as Revision 2. Package status: Ready for provider review.');
    expect(preparationSaveConfirmation({
      revision: 2,
      packageStatus: 'needs_information',
      idempotent: true,
    })).toContain('Already saved as Revision 2');
    expect(preparationSaveConfirmation({
      revision: 2,
      packageStatus: 'needs_information',
      idempotent: true,
    })).toContain('No duplicate revision was created.');
  });

  test('distinguishes a newly generated PDF from an idempotent replay', () => {
    expect(preparationPdfConfirmation({ revision: 3 })).toBe(
      'Preparation PDF generated for Revision 3.',
    );
    expect(preparationPdfConfirmation({ revision: 3, created: false })).toBe(
      'PDF already exists for Revision 3; no duplicate artifact was created.',
    );
  });

  test('keeps generated PDFs attached when revision IDs arrive in a different scalar type', () => {
    expect(findPreparationPdfArtifact(
      [{ id: 'artifact-1', source_revision_id: 'revision-7', source_revision: 7 }],
      { id: 7, revision: 7, package_hash: 'hash-7' },
    )).toEqual(expect.objectContaining({ id: 'artifact-1' }));
  });

  test('matches an older artifact by revision number and hash when its source ID is absent', () => {
    expect(findPreparationPdfArtifact(
      [{ id: 'artifact-legacy', source_revision: 7, source_revision_hash: 'hash-7' }],
      { id: 'revision-7', revision: 7, package_hash: 'hash-7' },
    )).toEqual(expect.objectContaining({ id: 'artifact-legacy' }));
  });

  test('matches a live provenance gap to the confirmed canonical field', () => {
    expect(getCurrentProvenanceGap(
      {
        key: 'transaction.value',
        label: 'Transaction value',
        state: {
          fieldId: 'field-value',
          field: { field_key: 'transaction.value', display_label: 'Transaction value' },
        },
      },
      [{ field_key: 'transaction.value', label: 'Transaction value', requirement: 'Owner approval required' }],
    )).toEqual(expect.objectContaining({ field_key: 'transaction.value' }));
  });

  test('does not show a provenance action for an unrelated confirmed field', () => {
    expect(getCurrentProvenanceGap(
      { key: 'asset.name', label: 'Asset name' },
      [{ field_key: 'transaction.value', label: 'Transaction value' }],
    )).toBeNull();
  });

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

  test('deduplicates borrower-funds actions across legacy field aliases', () => {
    expect(dedupeAttentionItems([
      {
        title: 'Provide Borrower funds advanced',
        fieldKey: 'financial.borrower_funds_advanced',
      },
      {
        title: 'Advance borrower funds',
        routeItem: { field_key: 'financial.borrower_advanced_funds' },
      },
    ])).toHaveLength(1);
  });

  test('builds awaiting actions from canonical required fields, not stale raw rows', () => {
    const recordState = {
      requiredFields: [
        { key: 'financial.repair_cost', fieldId: 'canonical-1', label: 'Repair Costs', value: '$325,000', status: 'confirmed' },
        { key: 'financial.proceeds', fieldId: 'canonical-2', label: 'Insurance Proceeds', value: '$325,000', status: 'awaiting' },
      ],
    };
    const rawRows = [
      { id: 'old-1', field_key: 'financial.repair_cost', value_text: '$229,950', status: 'extracted' },
      { id: 'old-2', field_key: 'financial.proceeds', value_text: '$180,000', status: 'extracted' },
    ];

    expect(getCanonicalAwaitingRecordFields(recordState)).toEqual([
      recordState.requiredFields[1],
    ]);
    expect(getCanonicalAwaitingRecordFields(recordState)).not.toContain(rawRows[0]);
    expect(getCanonicalAwaitingRecordFields(recordState)).not.toContain(rawRows[1]);
  });

  test('does not keep an awaiting borrower-funds alias after confirmation', () => {
    const recordState = {
      requiredFields: [
        {
          key: 'financial.borrower_advanced_funds',
          label: 'Borrower funds advanced',
          value: '90,000',
          status: 'awaiting',
        },
        {
          key: 'financial.borrower_funds_advanced',
          label: 'Borrower funds advanced',
          value: '9,000',
          status: 'confirmed',
        },
      ],
    };

    expect(getCanonicalAwaitingRecordFields(recordState)).toEqual([]);
    expect(filterStaleRecordActions([
      'Advance borrower funds before review',
    ], recordState)).toEqual([]);
  });

  test('replaces a previous canonical array when the newer response is empty', () => {
    const previous = {
      requiredFields: [{ key: 'financial.borrower_funds_advanced', status: 'awaiting', value: '90,000' }],
      fields: [{ key: 'financial.borrower_funds_advanced', status: 'awaiting', value: '90,000' }],
      unresolvedConflicts: [{ fieldKey: 'financial.borrower_funds_advanced' }],
    };
    const incoming = {
      requiredFields: [],
      fields: [],
      unresolvedConflicts: [],
      confirmedCount: 0,
    };

    expect(mergeTransactionRecordState(previous, incoming)).toEqual(expect.objectContaining({
      requiredFields: [],
      fields: [],
      unresolvedConflicts: [],
      confirmedCount: 0,
    }));
  });

  test('removes a stale extracted funds action after canonical confirmation', () => {
    const recordState = {
      requiredFields: [
        {
          key: 'financial.borrower_funds_advanced',
          label: 'Borrower funds advanced',
          value: '9,000',
          status: 'confirmed',
        },
        {
          key: 'funding.request',
          label: 'Funding request',
          value: '',
          status: 'missing',
        },
        {
          key: 'organization.investor_or_agency',
          label: 'Investor / agency',
          value: '',
          status: 'missing',
        },
      ],
    };

    expect(filterStaleRecordActions([
      'Borrower Advanced Funds — confirm 90,000',
    ], recordState)).toEqual([]);
  });

  test('provides real edit destinations for hazard-loss operational fields', () => {
    const definitions = getHazardLossOperationalFieldDefinitions({
      property_name: 'Freddie Mac Multifamily Hazard Loss Review',
    });

    expect(definitions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'financial.borrower_funds_advanced',
        category: 'financial',
        workflowRequired: true,
      }),
      expect.objectContaining({
        key: 'funding.request',
        category: 'financial',
        workflowRequired: true,
      }),
      expect.objectContaining({
        key: 'organization.investor_or_agency',
        category: 'parties',
        workflowRequired: true,
      }),
    ]));
  });

  test('recognizes sparse hazard-loss rooms from canonical generated field keys', () => {
    const definitions = getHazardLossOperationalFieldDefinitions(
      { property_name: 'Multifamily review' },
      {
        fields: [
          { key: 'funding.request', display_label: 'Fund Release Request' },
          { key: 'financial.borrower_advanced_funds', display_label: 'Borrower funds advanced' },
        ],
      },
    );

    expect(definitions.map(field => field.key)).toEqual(expect.arrayContaining([
      'funding.request',
      'financial.borrower_funds_advanced',
      'organization.investor_or_agency',
    ]));
  });

  test('matches string briefing actions to their canonical record field', () => {
    expect(actionTextMentionsRecordField(
      'Borrower Advanced Funds — confirm 90,000',
      { label: 'Borrower funds advanced', key: 'financial.borrower_funds_advanced' },
    )).toBe(true);
  });

  test('matches alternate advance-funds wording to the canonical borrower field', () => {
    expect(actionTextMentionsRecordField(
      'Advance borrower funds before the next review',
      { label: 'Borrower funds advanced', key: 'financial.borrower_funds_advanced' },
    )).toBe(true);
  });

  test('matches the historical confirm borrower advanced funds wording', () => {
    const recordState = {
      requiredFields: [{
        key: 'financial.borrower_funds_advanced',
        value_text: '9,000',
        status: 'confirmed',
      }],
    };

    expect(actionTextMentionsRecordField(
      'Confirm Borrower Advanced Funds',
      { key: 'financial.borrower_funds_advanced' },
    )).toBe(true);
    expect(filterStaleRecordActions([{
      title: 'Confirm Borrower Advanced Funds',
      reason: 'Kontra extracted "90,000" from an uploaded document. Confirm this is correct.',
    }], recordState)).toEqual([]);
  });

  test('removes borrower-funds briefing copies from next actions', () => {
    expect(isBorrowerFundsRecordAction({
      title: 'Confirm Borrower Advanced Funds',
      reason: 'Kontra extracted "90,000" from an uploaded document.',
    })).toBe(true);
    expect(isBorrowerFundsRecordAction({
      title: 'Confirm Funding Request',
    })).toBe(false);
  });

  test('keeps investor organization fields in Identity & Parties', () => {
    expect(normalizeRecordCategory('organization', 'organization.investor_or_agency'))
      .toBe('parties');
    expect(getTransactionRecordCategory({
      field_key: 'organization.investor_or_agency',
      display_label: 'Investor / agency',
    })).toBe('parties');
  });

  test('keeps unresolved record actions tied to their canonical field', () => {
    const recordState = {
      requiredFields: [
        { key: 'funding.request', label: 'Funding request', value: '', status: 'missing' },
      ],
    };
    const canonicalActionKeys = new Set(['funding.request']);

    expect(filterStaleRecordActions([
      { title: 'Confirm the funding request' },
    ], recordState, [], canonicalActionKeys)).toEqual([]);
    expect(filterStaleRecordActions([
      { title: 'Review unrelated underwriting note' },
    ], recordState, [], canonicalActionKeys)).toHaveLength(1);
  });

  test('routes generated-room record actions to a real generated field', () => {
    const generatedDefinitions = [
      {
        key: 'deal.asking_price',
        label: 'Asking price',
        category: 'transaction_extra',
      },
      {
        key: 'party.primary_owner',
        label: 'Primary owner',
        category: 'participants',
      },
    ];

    expect(getRecordActionTarget(
      { field_key: 'transaction.terms' },
      generatedDefinitions,
    )).toEqual(generatedDefinitions[0]);
  });

  test('routes Hazard Loss Review field actions through the canonical financial category', () => {
    const hazardDefinitions = [
      {
        key: 'funding.request',
        label: 'Funding request',
        category: 'financial',
      },
    ];

    expect(getRecordActionTarget(
      { field_key: 'financial.deal_value' },
      hazardDefinitions,
    )).toEqual(hazardDefinitions[0]);
  });

  test('uses canonical unresolved conflicts and deduplicates by canonical field key', () => {
    const recordState = {
      unresolvedConflicts: [
        { id: 'conflict-1', fieldKey: 'financial.repair_cost', label: 'Repair Cost' },
        { id: 'conflict-2', fieldKey: 'financial.repair_cost', label: 'Repair Cost' },
        { id: 'conflict-3', fieldKey: 'financial.proceeds', label: 'Insurance Proceeds' },
      ],
    };
    const fallbackConflicts = [
      { id: 'raw-status-row', fieldKey: 'financial.repair_cost', label: 'Raw status row' },
    ];

    expect(getCanonicalUnresolvedConflicts(recordState, fallbackConflicts))
      .toEqual([recordState.unresolvedConflicts[0], recordState.unresolvedConflicts[2]]);
    expect(getCanonicalUnresolvedConflicts(null, fallbackConflicts)).toEqual([]);
  });

  test('creates a Review Discrepancy item for a legacy field-only conflict', () => {
    expect(getCanonicalUnresolvedConflicts({
      fields: [{
        fieldId: 'reporting-period-field',
        key: 'financial.reporting_period',
        label: 'Reporting Period',
        value: '2025',
        status: 'conflict',
        conflictCandidates: [{ value: '2024', source_doc_id: 'annual-report' }],
      }],
    })).toEqual([expect.objectContaining({
      fieldKey: 'financial.reporting_period',
      canonicalValue: '2025',
      conflictingValue: '2024',
      conflictingSourceDocId: 'annual-report',
    })]);
  });
});