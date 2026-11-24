'use strict';

jest.mock('../db', () => {
  const createdRows = [];
  const updatedRows = [];
  const selectedColumns = [];
  let room = {};
  let customPackConfig = null;
  let existingTasks = [];
  let documentAnalyses = [];
  const supabase = {
    __configure(nextRoom, nextPackConfig = null, nextExistingTasks = [], nextDocumentAnalyses = []) {
      room = nextRoom;
      customPackConfig = nextPackConfig;
      existingTasks = nextExistingTasks;
      documentAnalyses = nextDocumentAnalyses;
      createdRows.length = 0;
      updatedRows.length = 0;
      selectedColumns.length = 0;
    },
    __createdRows: createdRows,
    __updatedRows: updatedRows,
    __selectedColumns: selectedColumns,
    from(table) {
      let inserted = null;
      let updated = null;
      const query = {
        select: jest.fn(columns => {
          selectedColumns.push({ table, columns });
          return query;
        }),
        eq: jest.fn(() => query),
        order: jest.fn(() => query),
        maybeSingle: jest.fn(async () => ({
          data: updated
            ? { ...(existingTasks[0] || {}), ...updated }
            : table === 'deal_rooms'
              ? room
              : table === 'custom_workflow_packs' ? { config: customPackConfig } : null,
          error: null,
        })),
        then: (resolve, reject) => Promise.resolve({
          data: table === 'deal_room_tasks'
            ? existingTasks
            : table === 'deal_analyses' ? documentAnalyses : [],
          error: null,
        }).then(resolve, reject),
        insert: jest.fn(row => {
          inserted = row;
          createdRows.push(row);
          return query;
        }),
        update: jest.fn(values => {
          updated = values;
          updatedRows.push({ table, values });
          return query;
        }),
        single: jest.fn(async () => ({
          data: { id: `created-${createdRows.length}`, ...inserted },
          error: null,
        })),
      };
      return query;
    },
  };
  return { supabase };
});

jest.mock('./dealRoomHelpers', () => ({
  DEFAULT_PACK_ID: 'cre_acquisition',
  getPackRoleConfig: jest.fn(() => ({ roles: [{ key: 'counsel' }, { key: 'issuer' }] })),
  getPackRoleLabel: jest.fn((_packId, role) => role),
  getRoomPackId: jest.fn(),
  sendResendEmail: jest.fn(),
  logEvent: jest.fn(() => Promise.resolve()),
}));
jest.mock('./emailConfig', () => ({ TRANSACTION_NOTIFICATION_FROM: 'test@example.invalid' }));
jest.mock('./eventBus', () => ({ emit: jest.fn() }));
jest.mock('./documentVersions', () => ({
  ...jest.requireActual('./documentVersions'),
  selectActiveDocumentVersions: rows => rows,
}));
jest.mock('./taskSubmissionQuery', () => ({ loadTaskSubmissions: jest.fn() }));
jest.mock('./recordRemediation', () => ({
  getRecordRemediationPlan: jest.fn(() => ({ upsert: [], dismiss: [] })),
}));
jest.mock('./participantCompletion', () => ({ resolveParticipantCompletions: jest.fn(() => []) }));
jest.mock('./transactionState', () => ({ readTransactionState: jest.fn() }));

const { supabase } = require('../db');
const { getPackRoleConfig, getRoomPackId } = require('./dealRoomHelpers');
const { loadTaskSubmissions } = require('./taskSubmissionQuery');
const { readTransactionState } = require('./transactionState');
const REDWOOD_PACK_ID = 'ws_redwood_business_center_acquis_mwk1m4zr';
const REDWOOD_DOCUMENTS = [
  { id: 'letter_of_intent', label: 'Letter of Intent', required: true, assignedTo: ['buyer'] },
  { id: 'property_inspection_report', label: 'Property Inspection Report', required: true, assignedTo: ['buyer'] },
  { id: 'title_report', label: 'Title Report', required: true, assignedTo: ['buyer'] },
  { id: 'financing_documents', label: 'Financing Documents', required: true, assignedTo: ['buyer'] },
  { id: 'closing_documents', label: 'Closing Documents', required: true, assignedTo: ['buyer'] },
  { id: 'financial_statements', label: 'Financial Statements', required: true, assignedTo: ['financial_advisor'] },
];
function configureInspectionTaskEvaluation({
  analysis,
  existingTasks = [],
  documentId = 'inspection-report-current',
  workflowStage = null,
}) {
  const checklist = [{
    id: 'property_inspection_report',
    section: 'property_inspection_report',
    label: 'Property Inspection Report',
    required: false,
    assignedTo: ['buyer'],
    ...(workflowStage ? { workflow_stage: workflowStage } : {}),
  }];
  const pack = {
    roles: [{ key: 'buyer' }],
    documents: checklist,
  };
  const room = {
    workflow_pack_id: REDWOOD_PACK_ID,
    deal_type: 'cre_acquisition',
    metadata_values: { digital_asset_enabled: false },
    jurisdiction: null,
    deal_stage: 'due_diligence',
    checklist_items: checklist,
  };
  getRoomPackId.mockResolvedValue(REDWOOD_PACK_ID);
  getPackRoleConfig.mockReturnValue({
    roles: [{ key: 'buyer', label: 'Buyer', required: false, needsDocs: false }],
  });
  loadTaskSubmissions.mockResolvedValue({ data: [{ role: 'buyer', doc_count: 1 }] });
  supabase.__configure(room, pack, existingTasks, [{
    id: documentId,
    property_id: 'redwood-business-center-acquisition',
    section: 'property_inspection_report',
    filename: 'Redwood inspection report.pdf',
    processing_status: 'extracted',
    is_active: true,
    created_at: '2026-11-23T10:00:00.000Z',
    analysis: { summary: 'Inspection analysis available.', ...analysis },
  }]);
  readTransactionState.mockResolvedValue({
    room,
    recordState: { requiredFields: [] },
  });
}

const { evaluateDealRoomForTasks, evaluateReadinessTasks } = require('./taskEngine');

describe('Digital Asset readiness task generation', () => {
  beforeEach(() => {
    supabase.__configure({
      workflow_pack_id: 'cre_acquisition',
      deal_type: 'cre_acquisition',
      metadata_values: { digital_asset_enabled: false },
      jurisdiction: 'us_ca',
      checklist_items: [],
    });
    getRoomPackId.mockResolvedValue('cre_acquisition');
    getPackRoleConfig.mockReset().mockReturnValue({
      roles: [{ key: 'counsel' }, { key: 'issuer' }],
    });
    loadTaskSubmissions.mockResolvedValue({ data: [] });
    readTransactionState.mockReset();
  });

  test('does not create token issuance tasks for an acquisition with false or false-string opt-out', async () => {
    for (const flag of [false, 'false']) {
      supabase.__configure({
        workflow_pack_id: 'ws_custom_acquisition',
        deal_type: 'cre_acquisition',
        metadata_values: { digital_asset_enabled: flag },
        jurisdiction: null,
        checklist_items: [],
      }, { transactionType: 'cre_acquisition' });
      await expect(evaluateReadinessTasks('synthetic-acquisition', [])).resolves.toEqual([]);
      expect(supabase.__createdRows).toHaveLength(0);
    }
  });

  test('supports an explicit Digital Asset layer on a non-tokenization acquisition', async () => {
    supabase.__configure({
      workflow_pack_id: 'ws_custom_acquisition',
      deal_type: 'cre_acquisition',
      metadata_values: { digital_asset_enabled: true, raise_target: '12000000' },
      jurisdiction: 'us_ca',
      checklist_items: [],
    }, { transactionType: 'cre_acquisition' });

    const created = await evaluateReadinessTasks('synthetic-mixed-workflow', []);

    expect(created.map(task => task.source_id)).not.toContain('readiness-issuance:raise_amount');
    expect(created.map(task => task.source_id)).toEqual(expect.arrayContaining([
      'readiness-issuance:token_price',
      'readiness-issuance:asset_type',
      'readiness-issuance:min_investment',
    ]));
    expect(created).toHaveLength(3);
    expect(created.every(task =>
      task.task_type === 'readiness_setup'
        && task.source_type === 'readiness'
        && task.category === 'readiness'
    )).toBe(true);
  });

  test('uses the configured tokenization workflow and preserves dismissed-task history', async () => {
    supabase.__configure({
      workflow_pack_id: 'ws_custom_tokenization',
      deal_type: 'tokenization',
      metadata_values: {},
      jurisdiction: 'us_ca',
      checklist_items: [],
    }, { transactionType: 'tokenization' });

    const existing = [
      { source_id: 'readiness-issuance:token_price', status: 'dismissed' },
      { source_id: 'readiness-issuance:asset_type', status: 'pending' },
    ];
    const created = await evaluateReadinessTasks('synthetic-tokenization', existing);

    expect(created.map(task => task.source_id)).not.toContain('readiness-issuance:token_price');
    expect(created.map(task => task.source_id)).not.toContain('readiness-issuance:asset_type');
    expect(created).toHaveLength(2);
  });

  test('wires a synthetic acquisition checklist through task evaluation with its assigned participant role', async () => {
    const checklist = [{
      id: 'financing-commitment',
      label: 'Financing Commitment',
      required: true,
      status: 'pending',
      assignedTo: ['counsel'],
      workflow_stage: 'due_diligence',
    }];
    readTransactionState.mockResolvedValue({
      room: {
        workflow_pack_id: 'cre_acquisition',
        deal_stage: 'due_diligence',
        checklist_items: checklist,
      },
      recordState: { requiredFields: [] },
    });

    const created = await evaluateDealRoomForTasks('synthetic-acquisition');

    expect(created).toEqual(expect.arrayContaining([
      expect.objectContaining({
        task_type: 'missing_document',
        title: 'Upload Financing Commitment',
        source_type: 'workflow_checklist',
        owner_role: 'counsel',
      }),
    ]));
    expect(supabase.__createdRows).toHaveLength(1);
  });

  test.each([
    ['null', null],
    ['empty', []],
  ])('generates all six Redwood custom-pack document tasks when the saved checklist is %s', async (_label, checklistItems) => {
    const customPackConfig = {
      roles: [{ key: 'buyer' }, { key: 'financial_advisor' }],
      documents: REDWOOD_DOCUMENTS,
    };
    getRoomPackId.mockResolvedValue(REDWOOD_PACK_ID);
    supabase.__configure({}, customPackConfig);
    readTransactionState.mockResolvedValue({
      room: {
        workflow_pack_id: REDWOOD_PACK_ID,
        deal_stage: 'due_diligence',
        checklist_items: checklistItems,
      },
      recordState: { requiredFields: [] },
    });

    const created = await evaluateDealRoomForTasks('redwood-business-center-acquisition');

    expect(created).toHaveLength(6);
    expect(created.map(task => task.title)).toEqual([
      'Upload Letter of Intent',
      'Upload Property Inspection Report',
      'Upload Title Report',
      'Upload Financing Documents',
      'Upload Closing Documents',
      'Upload Financial Statements',
    ]);
    expect(created.filter(task => task.owner_role === 'buyer')).toHaveLength(5);
    expect(created.filter(task => task.owner_role === 'financial_advisor')).toHaveLength(1);
    expect(supabase.__createdRows.map(task => task.source_id)).toEqual(
      REDWOOD_DOCUMENTS.map(document => `workflow-checklist:${document.id}`)
    );
  });

  test('uses explicit room checklist items and honors workflow-stage restrictions', async () => {
    const savedChecklist = [
      {
        id: 'current-stage-document',
        label: 'Current Stage Document',
        required: true,
        assignedTo: ['buyer'],
        workflow_stage: 'due_diligence',
      },
      {
        id: 'future-stage-document',
        label: 'Future Stage Document',
        required: true,
        assignedTo: ['financial_advisor'],
        workflow_stage: 'closing',
      },
    ];
    getRoomPackId.mockResolvedValue(REDWOOD_PACK_ID);
    supabase.__configure({
      workflow_pack_id: REDWOOD_PACK_ID,
      checklist_items: savedChecklist,
    }, {
      roles: [{ key: 'buyer' }, { key: 'financial_advisor' }],
      documents: REDWOOD_DOCUMENTS,
    });
    readTransactionState.mockResolvedValue({
      room: {
        workflow_pack_id: REDWOOD_PACK_ID,
        deal_stage: 'due_diligence',
        checklist_items: savedChecklist,
      },
      recordState: { requiredFields: [] },
    });

    const created = await evaluateDealRoomForTasks('synthetic-stage-restrictions');

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      title: 'Upload Current Stage Document',
      owner_role: 'buyer',
      source_id: 'workflow-checklist:current-stage-document',
    });
    expect(created.map(task => task.title)).not.toContain('Upload Future Stage Document');
    expect(supabase.__createdRows).toHaveLength(1);
  });

  test('completes Redwood Letter of Intent from its stored non-AI checklist receipt', async () => {
    const requirement = {
      id: 'letter_of_intent',
      section: 'letter_of_intent',
      label: 'Letter of Intent',
      required: true,
      ai: false,
      assignedTo: ['buyer'],
    };
    const existingTask = {
      id: 'redwood-letter-of-intent-task',
      property_id: 'redwood-business-center-acquisition',
      task_type: 'missing_document',
      title: 'Upload Letter of Intent',
      source_type: 'workflow_checklist',
      source_id: 'workflow-checklist:letter_of_intent',
      status: 'pending',
      evidence: ['Active workflow checklist item "Letter of Intent" is required but missing.'],
    };
    const uploadedDocument = {
      id: 'redwood-sample-letter-of-intent',
      section: 'letter_of_intent',
      filename: 'Redwood_SAMPLE_Letter_of_Intent.pdf',
      storage_path: 'deal-rooms/redwood-synthetic/letter-of-intent.pdf',
      processing_status: 'extracted',
      is_active: true,
      created_at: '2026-11-21T20:56:29.834Z',
      analysis: { pending: false, documentType: 'Letter Of Intent' },
    };
    const customPackConfig = { roles: [], documents: [requirement] };
    supabase.__configure(
      {},
      customPackConfig,
      [existingTask],
      [uploadedDocument],
    );
    getRoomPackId.mockResolvedValue(REDWOOD_PACK_ID);
    readTransactionState.mockResolvedValue({
      room: {
        workflow_pack_id: REDWOOD_PACK_ID,
        deal_stage: 'due_diligence',
        checklist_items: null,
      },
      recordState: { requiredFields: [] },
    });

    const resolved = await evaluateDealRoomForTasks('redwood-business-center-acquisition');

    expect(resolved).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: existingTask.id,
        status: 'completed',
        evidence: expect.arrayContaining([
          expect.stringContaining('contents were not AI-validated'),
        ]),
      }),
    ]));
    expect(supabase.__createdRows).toEqual([]);
    expect(supabase.__updatedRows).toEqual([expect.objectContaining({
      table: 'deal_room_tasks',
      values: expect.objectContaining({ status: 'completed' }),
    })]);
    expect(supabase.__selectedColumns.find(item => item.table === 'deal_analyses')?.columns)
      .toContain('storage_path');
  });

  test('does not recreate an existing dismissed custom-pack task during refresh', async () => {
    const dismissedTask = {
      id: 'dismissed-letter-of-intent',
      task_type: 'missing_document',
      source_type: 'workflow_checklist',
      source_id: 'workflow-checklist:letter_of_intent',
      status: 'dismissed',
    };
    getRoomPackId.mockResolvedValue(REDWOOD_PACK_ID);
    supabase.__configure({}, {
      roles: [{ key: 'buyer' }, { key: 'financial_advisor' }],
      documents: REDWOOD_DOCUMENTS,
    }, [dismissedTask]);
    readTransactionState.mockResolvedValue({
      room: {
        workflow_pack_id: REDWOOD_PACK_ID,
        deal_stage: 'due_diligence',
        checklist_items: [],
      },
      recordState: { requiredFields: [] },
    });

    const created = await evaluateDealRoomForTasks('synthetic-dismissed-history');

    expect(created).toHaveLength(5);
    expect(created.map(task => task.source_id)).not.toContain(dismissedTask.source_id);
    expect(supabase.__createdRows.map(task => task.source_id)).not.toContain(dismissedTask.source_id);
  });

  test('resolves a stale no-submission task after a participant submission is recorded', async () => {
    const staleTask = {
      id: 'missing-buyer-submission',
      property_id: 'redwood-business-center-acquisition',
      task_type: 'missing_participant',
      source_type: 'party_role',
      source_id: 'missing-role:buyer',
      status: 'pending',
      evidence: ['No party_submissions record found for role "buyer" (Buyer).'],
    };
    const packRoles = [{
      key: 'buyer',
      label: 'Buyer',
      required: true,
      needsDocs: true,
      invitable: true,
    }];
    getRoomPackId.mockResolvedValue(REDWOOD_PACK_ID);
    getPackRoleConfig.mockReturnValue({ roles: packRoles });
    loadTaskSubmissions.mockResolvedValue({
      data: [{ role: 'buyer', doc_count: 2, submitted_at: '2026-11-23T12:00:00.000Z' }],
    });
    supabase.__configure({
      workflow_pack_id: REDWOOD_PACK_ID,
      deal_type: 'cre_acquisition',
      metadata_values: { digital_asset_enabled: false },
      deal_stage: 'due_diligence',
      checklist_items: [],
    }, { roles: packRoles, documents: [] }, [staleTask], []);
    readTransactionState.mockResolvedValue({
      room: {
        workflow_pack_id: REDWOOD_PACK_ID,
        deal_stage: 'due_diligence',
        checklist_items: [],
      },
      recordState: { requiredFields: [] },
    });

    await evaluateDealRoomForTasks('redwood-business-center-acquisition', {
      source: 'participant_submission_recorded',
    });

    expect(supabase.__createdRows).toEqual([]);
    expect(supabase.__updatedRows).toEqual([expect.objectContaining({
      table: 'deal_room_tasks',
      values: expect.objectContaining({
        status: 'completed',
        resolved_at: expect.any(String),
        evidence: expect.stringContaining('party_submissions record is now present'),
      }),
    })]);
  });

  test('creates role-assigned inspection follow-ups from actionable recommendations, not every risk flag', async () => {
    configureInspectionTaskEvaluation({
      analysis: {
        risk_flags: [
          'An observation is recorded for future consideration.',
          'The report describes the age of an installed system.',
          'A general site condition is noted.',
          'The document includes a non-urgent contextual note.',
        ],
        recommendations: [
          'Schedule a qualified contractor to repair the roof drain.',
          'Verify the fire alarm controls during the next inspection.',
        ],
      },
    });

    const created = await evaluateDealRoomForTasks('redwood-business-center-acquisition');
    const followUps = created.filter(task => task.task_type === 'inspection_follow_up');

    expect(followUps).toHaveLength(2);
    expect(followUps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        owner_role: 'buyer',
        source_type: 'inspection_analysis',
        category: 'inspection',
        source_document_id: 'inspection-report-current',
        title: expect.stringContaining('Inspection follow-up:'),
      }),
    ]));
    const followUpEvidence = followUps.flatMap(task =>
      Array.isArray(task.evidence) ? task.evidence : JSON.parse(task.evidence),
    );
    expect(followUpEvidence.join(' ')).toContain('not independently verified');
    expect(supabase.__createdRows.filter(task => task.task_type === 'inspection_follow_up'))
      .toHaveLength(2);
  });

  test('creates structured inspection deficiency and priority-action tasks with evidence links', async () => {
    configureInspectionTaskEvaluation({
      analysis: {
        lifeSafetyFindings: [{
          item: 'Stair guardrail',
          severity: 'Critical',
          description: 'The guardrail is below the required height.',
        }],
        deferredMaintenance: [{
          item: 'Roof drain repair',
          priority: 'High',
          estimatedCost: '$2,000',
          timeline: 'Before closing',
        }],
        priorityActions: [{
          action: 'Test the fire alarm controls.',
          timeline: 'Within 30 days',
        }],
      },
    });

    const created = await evaluateDealRoomForTasks('redwood-business-center-acquisition');
    const followUps = created.filter(task => task.task_type === 'inspection_follow_up');

    expect(followUps).toHaveLength(3);
    expect(followUps.map(task => task.severity)).toEqual(expect.arrayContaining(['high', 'medium']));
    expect(followUps.every(task =>
      task.owner_role === 'buyer' && task.source_document_id === 'inspection-report-current'
    )).toBe(true);
  });

  test('respects the checklist workflow stage for inspection follow-up tasks', async () => {
    configureInspectionTaskEvaluation({
      workflowStage: 'closing',
      analysis: { recommendations: ['Repair the roof drain before closing.'] },
    });

    const created = await evaluateDealRoomForTasks('redwood-business-center-acquisition');

    expect(created.filter(task => task.task_type === 'inspection_follow_up')).toEqual([]);
    expect(supabase.__createdRows.filter(task => task.task_type === 'inspection_follow_up')).toEqual([]);
  });

  test('does not create tasks from informational inspection flags without action evidence', async () => {
    configureInspectionTaskEvaluation({
      analysis: {
        risk_flags: [
          'The property is located near a commercial corridor.',
          'The inspection includes a general condition observation.',
        ],
        recommendations: [],
      },
    });

    const created = await evaluateDealRoomForTasks('redwood-business-center-acquisition');

    expect(created.filter(task => task.task_type === 'inspection_follow_up')).toEqual([]);
    expect(supabase.__createdRows.filter(task => task.task_type === 'inspection_follow_up')).toEqual([]);
  });

  test('creates a follow-up for a clear actionable deficiency flag', async () => {
    configureInspectionTaskEvaluation({
      analysis: {
        risk_flags: [
          'The stair guardrail is damaged and presents a safety hazard.',
          'The inspection report includes a general site observation.',
        ],
        recommendations: [],
      },
    });

    const created = await evaluateDealRoomForTasks('redwood-business-center-acquisition');
    const followUps = created.filter(task => task.task_type === 'inspection_follow_up');

    expect(followUps).toHaveLength(1);
    expect(followUps[0]).toEqual(expect.objectContaining({
      owner_role: 'buyer',
      source_document_id: 'inspection-report-current',
      severity: 'medium',
    }));
  });

  test('keeps dismissed inspection tasks dismissed and updates source evidence across replacements', async () => {
    const recommendation = 'Repair the roof drain before closing.';
    configureInspectionTaskEvaluation({ analysis: { recommendations: [recommendation] } });
    const first = await evaluateDealRoomForTasks('redwood-business-center-acquisition');
    const originalTask = first.find(task => task.task_type === 'inspection_follow_up');
    expect(originalTask).toBeTruthy();

    const replacementTask = {
      ...originalTask,
      id: 'inspection-follow-up-1',
      status: 'pending',
      source_document_id: 'inspection-report-old',
      evidence: JSON.stringify(['Original inspection evidence retained.']),
    };
    configureInspectionTaskEvaluation({
      documentId: 'inspection-report-replacement',
      analysis: { recommendations: [recommendation] },
      existingTasks: [replacementTask],
    });
    const replacementResult = await evaluateDealRoomForTasks('redwood-business-center-acquisition');

    expect(replacementResult.filter(task => task.task_type === 'inspection_follow_up')).toEqual([]);
    expect(supabase.__createdRows.filter(task => task.task_type === 'inspection_follow_up')).toEqual([]);
    expect(supabase.__updatedRows).toEqual([expect.objectContaining({
      table: 'deal_room_tasks',
      values: expect.objectContaining({
        source_document_id: 'inspection-report-replacement',
        evidence: expect.stringContaining('newer active inspection analysis'),
      }),
    })]);

    const dismissed = { ...replacementTask, status: 'dismissed' };
    configureInspectionTaskEvaluation({
      documentId: 'inspection-report-next',
      analysis: { recommendations: [recommendation] },
      existingTasks: [dismissed],
    });
    const dismissedResult = await evaluateDealRoomForTasks('redwood-business-center-acquisition');

    expect(dismissedResult.filter(task => task.task_type === 'inspection_follow_up')).toEqual([]);
    expect(supabase.__createdRows.filter(task => task.task_type === 'inspection_follow_up')).toEqual([]);
    expect(supabase.__updatedRows).toEqual([]);
  });
});
