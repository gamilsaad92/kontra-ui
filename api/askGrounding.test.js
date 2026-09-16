const workflowStages = require('../shared/workflowStages.json');
const { getPackRoleConfig } = require('./lib/dealRoomHelpers');

const mockReadTransactionState = jest.fn();
const mockListTasksForRoom = jest.fn();
const mockSupabaseFrom = jest.fn();
const mockOpenAICompletion = jest.fn();

jest.mock('./lib/transactionState', () => ({
  readTransactionState: (...args) => mockReadTransactionState(...args),
}));

jest.mock('./lib/taskEngine', () => ({
  listTasksForRoom: (...args) => mockListTasksForRoom(...args),
}));

jest.mock('./db', () => ({
  supabase: {
    from: (...args) => mockSupabaseFrom(...args),
  },
}));

jest.mock('openai', () => jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      create: (...args) => mockOpenAICompletion(...args),
    },
  },
})));

process.env.OPENAI_API_KEY = 'ask-grounding-test-key';

const {
  askQuestion,
  buildGroundedContext,
  getLiveMissingDocuments,
  askContextToPrompt,
  getBriefing,
  clearBriefingCache,
} = require('./lib/operationsManager');

const PACKS = Object.keys(workflowStages).filter(key => !key.startsWith('_'));
const QUESTIONS = [
  'What should happen next?',
  'What are the current blockers?',
  'What still needs verification?',
  'Could this transaction be prepared for tokenization?',
];

function completedParticipants(packId) {
  return getPackRoleConfig(packId).roles
    .filter(role => role.required && role.invitable !== false)
    .map(role => ({
      role: role.key,
      name: `${role.label} Test`,
      status: 'submitted',
      doc_count: 1,
      submitted_at: '2026-08-18T00:00:00.000Z',
    }));
}

function setupSupabaseQueries(packId) {
  const participantRows = completedParticipants(packId);
  mockSupabaseFrom.mockImplementation(table => {
    const result = table === 'party_submissions'
      ? participantRows
      : table === 'deal_room_invites'
        ? []
      : [];
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      then: resolve => resolve({ data: result, error: null }),
    };
    return chain;
  });
}

function setupCustomRoomQueries(roles, participantRows = [], invites = [], analyses = []) {
  mockSupabaseFrom.mockImplementation(table => {
    const result = table === 'custom_workflow_packs'
      ? { config: { roles } }
      : table === 'party_submissions'
        ? participantRows
        : table === 'deal_room_invites'
          ? invites
          : table === 'deal_analyses'
            ? analyses
          : [];
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => Promise.resolve({ data: result, error: null }),
      then: resolve => resolve({ data: result, error: null }),
    };
    return chain;
  });
}

function parseAskContext(messages) {
  const userMessage = messages.find(message => message.role === 'user');
  const contextText = userMessage.content
    .replace(/^Workspace context:\n/, '')
    .split('\n\nQuestion:')[0];
  return JSON.parse(contextText);
}

function parseTokenizationGuidance(messages) {
  const systemMessage = messages.find(message => message.role === 'system');
  const marker = 'tokenization_guidance:\n';
  const start = systemMessage.content.indexOf(marker);
  if (start === -1) return null;
  return JSON.parse(systemMessage.content.slice(start + marker.length));
}

describe('Ask Kontra grounding across Workflow Packs', () => {
  beforeEach(() => {
    mockReadTransactionState.mockReset();
    mockListTasksForRoom.mockReset();
    mockSupabaseFrom.mockReset();
    mockOpenAICompletion.mockReset();
    mockOpenAICompletion.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ answer: 'Grounded test answer', citedTaskIds: [] }) } }],
    });
  });

  test.each(PACKS)('%s uses only its resolved lifecycle and grounded blocker sources for every supported question', async packId => {
    const stages = workflowStages[packId].stages;
    const stage = stages[0];
    const recordFields = [
      { key: 'transaction.type', label: 'Transaction type', value: packId, status: 'confirmed' },
      { key: 'transaction.stage', label: 'Current stage', value: stage.key, status: 'confirmed' },
      { key: 'transaction.closing_date', label: 'Closing date', value: '2026-12-31', status: 'confirmed' },
    ];
    const recordState = {
      schemaKey: packId,
      fields: recordFields,
      requiredFields: recordFields,
      requiredCount: recordFields.length,
      confirmedCount: recordFields.length,
      awaitingRequiredCount: 0,
      conflictRequiredCount: 0,
      notApplicableCount: 0,
    };

    mockReadTransactionState.mockResolvedValue({
      packId,
      room: {
        property_id: 'grounding-room',
        property_name: `${packId} Grounding Room`,
        workflow_pack_id: packId,
        deal_type: packId,
        deal_stage: stage.key,
        closing_date: '2026-12-31',
        checklist_items: [],
        metadata_values: { digital_asset_enabled: false },
      },
      recordState,
      readiness: { digitalAssetEnabled: false, digitalAssetOptional: true },
    });
    mockListTasksForRoom.mockResolvedValue([]);
    setupSupabaseQueries(packId);

    for (const question of QUESTIONS) {
      await askQuestion('grounding-room', question);
      const messages = mockOpenAICompletion.mock.calls.at(-1)[0].messages;
      const context = parseAskContext(messages);

      expect(context.lifecycle.packId).toBe(packId);
      expect(context.lifecycle.currentStageKey).toBe(stage.key);
      expect(context.lifecycle.stages).toEqual(stages);
      expect(context).not.toHaveProperty('closing_chain');
      expect(context.blockers).toEqual([]);
      expect(messages[0].content).toContain('The blockers array is the complete factual blocker list');

      if (question.includes('tokenization')) {
        const guidance = parseTokenizationGuidance(messages);
        expect(guidance.enabled).toBe(packId === 'tokenization');
        expect(guidance.gaps).not.toEqual(expect.arrayContaining([
          expect.objectContaining({ key: 'transaction.type' }),
          expect.objectContaining({ key: 'transaction.stage' }),
          expect.objectContaining({ key: 'transaction.closing_date' }),
        ]));
        expect(messages[0].content).toContain('Transaction state first');
        expect(messages[0].content).toContain('Tokenization-specific gaps second');
      } else {
        expect(messages[0].content).not.toContain('tokenization_guidance:');
        expect(context.transaction_context.transaction.digitalAssetEnabled).toBe(packId === 'tokenization');
      }
    }
  });

  test('does not turn generic or unevidenced tasks into Ask Kontra blockers', () => {
    const blockers = require('./lib/operationsManager').buildGroundedBlockers({
      packId: 'cre_acquisition',
      recordState: { requiredFields: [] },
      missingDocuments: [],
      participants: completedParticipants('cre_acquisition'),
      tasks: [
        {
          id: 'generic-chain-task',
          title: 'Due Diligence',
          status: 'pending',
          blocking: false,
          evidence: ['generic task dependency'],
        },
        {
          id: 'unevidenced-task',
          title: 'Inspection and insurance',
          status: 'pending',
          blocking: true,
          evidence: [],
        },
        {
          id: 'real-blocker',
          title: 'Missing purchase agreement',
          status: 'pending',
          blocking: true,
          evidence: ['Required checklist item is incomplete.'],
        },
      ],
    });

    expect(blockers).toEqual([
      expect.objectContaining({
        sourceType: 'explicit_blocking_task',
        taskId: 'real-blocker',
      }),
    ]);
  });

  test('uses the live custom People roles instead of stale proposal or template roles', async () => {
    const customPackId = 'ws_cedar_grove_hazard';
    const liveRoles = [
      { key: 'deal_coordinator', label: 'Deal Coordinator', required: true, invitable: true, canManage: true, needsDocs: true },
      { key: 'property_owner', label: 'Property Owner', required: true, invitable: true, needsDocs: true },
      { key: 'insurance_agent', label: 'Insurance Agent', required: true, invitable: true, needsDocs: true },
    ];
    const recordState = {
      schemaKey: 'generated_ai',
      fields: [],
      requiredFields: [],
      requiredCount: 0,
      confirmedCount: 0,
      awaitingRequiredCount: 0,
      conflictRequiredCount: 0,
      notApplicableCount: 0,
      unresolvedConflicts: [],
    };
    mockReadTransactionState.mockResolvedValue({
      packId: customPackId,
      room: {
        property_id: 'cedar-grove-hazard',
        property_name: 'Cedar Grove Apartment Hazard Loss',
        workflow_pack_id: customPackId,
        deal_type: 'other',
        deal_stage: 'claim_filing',
        checklist_items: [],
        generated_proposal: {
          participants: [
            { role: 'buyer', label: 'Buyer', required: true },
            { role: 'seller', label: 'Seller', required: true },
            { role: 'legal_advisor', label: 'Legal Advisor', required: true },
            { role: 'financial_advisor', label: 'Financial Advisor', required: true },
          ],
        },
        metadata_values: { digital_asset_enabled: false },
      },
      recordState,
      conflicts: [],
      readiness: { digitalAssetEnabled: false, digitalAssetOptional: true },
    });
    mockListTasksForRoom.mockResolvedValue([
      {
        id: 'stale-buyer-task',
        task_type: 'missing_participant',
        source_id: 'missing-role:property_owner',
        source_type: 'party_role',
        status: 'pending',
        blocking: true,
        title: 'Property Owner has not been invited or submitted documents yet',
        evidence: ['stale role evidence'],
      },
    ]);
    setupCustomRoomQueries(liveRoles);

    const context = await buildGroundedContext('cedar-grove-hazard');
    const participantBlockers = context.groundedBlockers
      .filter(blocker => blocker.sourceType === 'required_participant');

    expect(participantBlockers.map(blocker => blocker.role)).toEqual([
      'property_owner',
      'insurance_agent',
    ]);
    expect(context.openTasks).toEqual([
      expect.objectContaining({
        title: 'Property Owner has no participant submission on record',
      }),
    ]);
    expect(context.transactionContext.operations.openTasks).toEqual([
      expect.objectContaining({
        title: 'Property Owner has no participant submission on record',
      }),
    ]);
    expect(context.transactionContext.participants).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'property_owner',
        submissionStatus: null,
        inviteStatus: null,
        invited: false,
      }),
    ]));
    expect(JSON.stringify(context)).not.toContain('has not been invited');
    expect(JSON.stringify(context)).toContain('No current active deal_room_invites.status is recorded');
    expect(JSON.stringify(context)).not.toContain('Buyer');
    expect(JSON.stringify(context)).not.toContain('Seller');
    expect(JSON.stringify(context)).not.toContain('Legal Advisor');
    expect(JSON.stringify(context)).not.toContain('Financial Advisor');
  });

  test('uses the canonical participant submission after an assigned Legal Advisor upload', async () => {
    const roles = [{
      key: 'attorney',
      label: 'Legal Advisor',
      required: true,
      invitable: true,
    }];
    const checklist = [{
      section: 'legal_due_diligence_report',
      label: 'Legal Due Diligence Report',
      required: true,
      assignedTo: ['attorney'],
      status: 'pending',
    }, {
      section: 'financials',
      label: 'Financial Statements',
      required: true,
      assignedTo: ['owner'],
      status: 'missing',
    }];
    mockReadTransactionState.mockResolvedValue({
      packId: 'ws_harbor_ridge',
      room: {
        property_id: 'harbor-ridge-production-regression',
        property_name: 'Harbor Ridge Manufacturing Acquisition',
        workflow_pack_id: 'ws_harbor_ridge',
        workflow_pack_config: { roles, documents: checklist },
        deal_type: 'other',
        deal_stage: 'due_diligence',
        checklist_items: checklist,
      },
      recordState: {
        schemaKey: 'generated_ai',
        fields: [],
        requiredFields: [],
        requiredCount: 0,
        confirmedCount: 0,
        awaitingRequiredCount: 0,
        conflictRequiredCount: 0,
        notApplicableCount: 0,
        unresolvedConflicts: [],
      },
      conflicts: [],
      readiness: {},
    });
    mockListTasksForRoom.mockResolvedValue([{
      id: 'stale-attorney-task',
      task_type: 'missing_participant',
      source_id: 'missing-role:attorney',
      source_type: 'party_role',
      status: 'pending',
      blocking: true,
      title: 'Legal Advisor has no participant submission on record',
      evidence: ['No party_submissions record found for role "attorney".'],
    }]);
    setupCustomRoomQueries(
      roles,
      [{ role: 'attorney', status: 'submitted', doc_count: 1 }],
      [{ role_key: 'attorney', status: 'active' }],
      [{
        id: 'legal-dd-report',
        section: 'legal_due_diligence_report',
        filename: 'legal-due-diligence-report.pdf',
        processing_status: 'extracted',
        is_active: true,
        superseded_at: null,
        analysis: { summary: 'Legal due diligence report analyzed.', pending: false },
        created_at: '2026-09-16T00:00:00.000Z',
      }],
    );

    const context = await buildGroundedContext('harbor-ridge-production-regression');
    expect(context.transactionContext.participants).toEqual([
      expect.objectContaining({
        role: 'attorney',
        label: 'Legal Advisor',
        submissionStatus: 'submitted',
        inviteStatus: 'active',
        documentCount: 1,
        assignedRequirements: expect.objectContaining({
          submissionRecorded: true,
          requiredCount: 1,
          completedRequiredCount: 1,
          missingRequiredCount: 0,
          complete: true,
          documents: [
            expect.objectContaining({
              label: 'Legal Due Diligence Report',
              required: true,
              received: true,
            }),
          ],
        }),
      }),
    ]);
    expect(context.groundedBlockers).toEqual([
      expect.objectContaining({
        sourceType: 'required_document',
        label: 'Financial Statements',
      }),
    ]);
    expect(context.openTasks).toEqual([]);
    expect(context.missingDocuments).toEqual([
      expect.objectContaining({ label: 'Financial Statements' }),
    ]);

    const promptContext = JSON.parse(askContextToPrompt(context));
    expect(promptContext.transaction_context.participants).toEqual([
      expect.objectContaining({
        role: 'attorney',
        assignedRequirements: expect.objectContaining({
          requiredCount: 1,
          completedRequiredCount: 1,
          complete: true,
        }),
      }),
    ]);

    const answer = await askQuestion(
      'harbor-ridge-production-regression',
      'Has the Legal Advisor completed their currently assigned requirement?',
    );
    expect(answer.answer).toContain('Yes');
    expect(answer.answer).toContain('Legal Due Diligence Report');
    expect(answer.answer).toContain('1 of 1');
    expect(answer.answer).toContain('other outstanding required documents outside this role');
    expect(mockOpenAICompletion).not.toHaveBeenCalled();
  });

  test('does not turn populated awaiting-confirmation fields into missing blockers', async () => {
    const recordState = {
      schemaKey: 'generated_ai',
      fields: [
        {
          key: 'financial.repair_costs',
          label: 'Repair Costs',
          value: '$325,000',
          status: 'awaiting',
          rawStatus: 'extracted',
          required: true,
        },
        {
          key: 'transaction.incident_date',
          label: 'Incident Date',
          value: null,
          status: 'missing',
          rawStatus: null,
          required: true,
        },
      ],
      requiredFields: [
        {
          key: 'financial.repair_costs',
          label: 'Repair Costs',
          value: '$325,000',
          status: 'awaiting',
          rawStatus: 'extracted',
          required: true,
        },
        {
          key: 'transaction.incident_date',
          label: 'Incident Date',
          value: null,
          status: 'missing',
          rawStatus: null,
          required: true,
        },
      ],
      requiredCount: 2,
      confirmedCount: 0,
      awaitingRequiredCount: 1,
      conflictRequiredCount: 0,
      notApplicableCount: 0,
      unresolvedConflicts: [],
    };
    mockReadTransactionState.mockResolvedValue({
      packId: 'cre_acquisition',
      room: {
        property_id: 'awaiting-room',
        property_name: 'Awaiting Confirmation Room',
        workflow_pack_id: 'cre_acquisition',
        deal_type: 'cre_acquisition',
        deal_stage: 'uploading',
        checklist_items: [],
        metadata_values: { digital_asset_enabled: false },
      },
      recordState,
      conflicts: [],
      readiness: { digitalAssetEnabled: false, digitalAssetOptional: true },
    });
    mockListTasksForRoom.mockResolvedValue([]);
    setupSupabaseQueries('cre_acquisition');

    const context = await buildGroundedContext('awaiting-room');
    const recordBlockers = context.groundedBlockers
      .filter(blocker => blocker.sourceType === 'transaction_record');

    expect(recordBlockers).toEqual([
      expect.objectContaining({ key: 'transaction.incident_date', status: 'missing' }),
    ]);
    expect(context.transactionContext.record.awaitingConfirmation).toEqual([
      expect.objectContaining({
        key: 'financial.repair_costs',
        status: 'awaiting_confirmation',
      }),
    ]);
    expect(JSON.stringify(recordBlockers)).not.toContain('Repair Costs');
  });

  test('leaves normal readiness unchanged when digital-asset preparation is disabled', async () => {
    const readiness = {
      digitalAssetEnabled: false,
      digitalAssetOptional: true,
      score: 42,
    };
    const recordState = {
      schemaKey: 'cre_acquisition',
      fields: [],
      requiredFields: [],
      requiredCount: 0,
      confirmedCount: 0,
      awaitingRequiredCount: 0,
      conflictRequiredCount: 0,
      notApplicableCount: 0,
    };
    mockReadTransactionState.mockResolvedValue({
      packId: 'cre_acquisition',
      room: {
        property_id: 'readiness-room',
        property_name: 'Readiness Room',
        workflow_pack_id: 'cre_acquisition',
        deal_type: 'cre_acquisition',
        deal_stage: 'uploading',
        checklist_items: [],
        metadata_values: { digital_asset_enabled: false },
      },
      recordState,
      readiness,
    });
    mockListTasksForRoom.mockResolvedValue([]);
    setupSupabaseQueries('cre_acquisition');

    const context = await buildGroundedContext('readiness-room');

    expect(context.readiness).toEqual(readiness);
    expect(context.transactionContext.transaction.digitalAssetEnabled).toBe(false);
  });

  test('does not call an uploaded or processing active document missing', () => {
    const checklist = [
      {
        id: 'damage-report',
        section: 'damage_assessment_report',
        label: 'Damage Assessment Report',
        required: true,
        status: 'missing',
        uploaded: false,
      },
      {
        id: 'policy',
        section: 'insurance_policy',
        label: 'Insurance Policy',
        required: true,
        status: 'missing',
        uploaded: false,
      },
    ];

    expect(getLiveMissingDocuments(checklist, [
      {
        id: 'damage-upload',
        section: 'damage_assessment_report',
        filename: 'damage-report.pdf',
        processing_status: 'processing',
        is_active: true,
      },
      {
        id: 'old-policy',
        section: 'insurance_policy',
        filename: 'old-policy.pdf',
        processing_status: 'complete',
        is_active: false,
        superseded_at: '2026-08-20T00:00:00.000Z',
      },
    ])).toEqual([
      expect.objectContaining({
        id: 'policy',
        label: 'Insurance Policy',
        section: 'insurance_policy',
      }),
    ]);
  });

  test('uses the live transaction checklist plus active analyses for briefing grounding', async () => {
    const recordState = {
      schemaKey: 'cre_acquisition',
      fields: [{ key: 'transaction.type', label: 'Transaction type', value: 'acquisition', status: 'confirmed' }],
      requiredFields: [],
      requiredCount: 0,
      confirmedCount: 0,
      awaitingRequiredCount: 0,
      conflictRequiredCount: 0,
      notApplicableCount: 0,
    };
    mockReadTransactionState.mockResolvedValue({
      packId: 'cre_acquisition',
      room: {
        property_name: 'Live evidence room',
        workflow_pack_id: 'cre_acquisition',
        deal_type: 'acquisition',
        checklist_items: [{
          section: 'purchase_agreement',
          label: 'Purchase Agreement',
          required: true,
          status: 'missing',
          uploaded: false,
        }],
      },
      recordState,
      readiness: {},
    });
    mockListTasksForRoom.mockResolvedValue([]);
    mockSupabaseFrom.mockImplementation(table => {
      const result = table === 'deal_analyses'
        ? [{
            id: 'purchase-upload',
            section: 'purchase_agreement',
            filename: 'purchase-agreement.pdf',
            analysis: { pending: true },
            processing_status: 'uploaded',
            created_at: '2026-08-30T00:00:00.000Z',
            is_active: true,
          }]
        : completedParticipants('cre_acquisition');
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        then: resolve => resolve({ data: result, error: null }),
      };
      return chain;
    });

    const context = await buildGroundedContext('live-evidence-room');
    expect(context.missingDocuments).toEqual([]);
    expect(context.documentFindings).toEqual([
      expect.objectContaining({ filename: 'purchase-agreement.pdf' }),
    ]);
    expect(context.transactionContext.evidence.missingDocuments).toEqual([]);
  });

  test('falls back to legacy analysis columns and reports only live missing documents', async () => {
    const checklist = [
      { id: 'loss_report', section: 'loss_report', label: 'Loss Report', required: true, status: 'missing' },
      { id: 'insurance_policy', section: 'insurance_policy', label: 'Insurance Policy', required: true, status: 'missing' },
      { id: 'damage_assessment', section: 'damage_assessment', label: 'Damage Assessment Report', required: true, status: 'missing' },
      { id: 'repair_estimate', section: 'repair_estimate', label: 'Repair Estimate', required: true, status: 'missing' },
      { id: 'claim_form', section: 'claim_form', label: 'Insurance Claim Form', required: true, status: 'missing' },
    ];
    const analyses = [
      {
        id: 'policy-upload',
        section: 'insurance_policy',
        filename: '01_Insurance_Policy.pdf',
        processing_status: 'extracted',
        analysis: { summary: 'Insurance policy received.' },
        created_at: '2026-08-30T22:51:57.384Z',
      },
      {
        id: 'loss-upload',
        section: 'loss_report',
        filename: '03_Damage_Report.pdf',
        processing_status: 'extracted',
        analysis: { summary: 'Loss report received.' },
        created_at: '2026-08-30T22:53:54.623Z',
      },
      {
        id: 'repair-upload',
        section: 'repair_estimate',
        filename: '02_Repair_Invoices.pdf',
        processing_status: 'extracted',
        analysis: { summary: 'Repair estimate received.' },
        created_at: '2026-08-30T22:54:24.293Z',
      },
      {
        id: 'cross-document-check',
        section: 'cross_document_verification',
        filename: 'cross-document-verification.json',
        processing_status: 'extracted',
        analysis: { summary: 'Cross-document check.' },
        created_at: '2026-08-30T22:54:29.855Z',
      },
    ];
    const recordState = {
      schemaKey: 'cre_acquisition',
      fields: [],
      requiredFields: [],
      requiredCount: 0,
      confirmedCount: 0,
      awaitingRequiredCount: 0,
      conflictRequiredCount: 0,
      notApplicableCount: 0,
    };

    mockReadTransactionState.mockResolvedValue({
      packId: 'cre_acquisition',
      room: {
        property_name: 'Cedar Grove Apartment Hazard Loss',
        workflow_pack_id: 'cre_acquisition',
        deal_type: 'other',
        deal_stage: 'claim_filing',
        checklist_items: checklist,
      },
      recordState,
      readiness: {},
    });
    mockListTasksForRoom.mockResolvedValue([]);
    mockSupabaseFrom.mockImplementation(table => {
      const result = table === 'deal_analyses' ? analyses : completedParticipants('cre_acquisition');
      const chain = {
        queryError: null,
        select: fields => {
          if (table === 'deal_analyses' && /is_active|superseded_at/.test(fields)) {
            chain.queryError = { message: 'column deal_analyses.is_active does not exist' };
          }
          return chain;
        },
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        then: resolve => resolve({ data: chain.queryError ? null : result, error: chain.queryError }),
      };
      return chain;
    });

    const context = await buildGroundedContext('cedar-grove-apartment-hazard-loss--1cdce74a');

    expect(context.missingDocuments).toEqual([
      expect.objectContaining({ id: 'damage_assessment', label: 'Damage Assessment Report', section: 'damage_assessment' }),
      expect.objectContaining({ id: 'claim_form', label: 'Insurance Claim Form', section: 'claim_form' }),
    ]);
    expect(context.transactionContext.evidence.activeDocumentState.documents)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'policy-upload', section: 'insurance_policy' }),
        expect.objectContaining({ id: 'loss-upload', section: 'loss_report' }),
        expect.objectContaining({ id: 'repair-upload', section: 'repair_estimate' }),
      ]));
    expect(context.groundedBlockers
      .filter(blocker => blocker.sourceType === 'required_document')
      .map(blocker => blocker.label))
      .toEqual(['Damage Assessment Report', 'Insurance Claim Form']);
  });

  test('answers document-status questions from live evidence without asking the LLM to infer missing files', async () => {
    const checklist = [
      { id: 'loss_report', section: 'loss_report', label: 'Loss Report', required: true, status: 'missing' },
      { id: 'insurance_policy', section: 'insurance_policy', label: 'Insurance Policy', required: true, status: 'missing' },
      { id: 'damage_assessment', section: 'damage_assessment', label: 'Damage Assessment Report', required: true, status: 'missing' },
      { id: 'repair_estimate', section: 'repair_estimate', label: 'Repair Estimate', required: true, status: 'missing' },
      { id: 'claim_form', section: 'claim_form', label: 'Insurance Claim Form', required: true, status: 'missing' },
    ];
    const analyses = [
      { id: 'loss-upload', section: 'loss_report', filename: '01_Loss_Documentation.docx', processing_status: 'complete', analysis: { summary: 'Loss report received.' }, created_at: '2026-09-03T01:29:35.077Z' },
      { id: 'policy-upload', section: 'insurance_policy', filename: '02_Insurance_Coverage.docx', processing_status: 'complete', analysis: { summary: 'Insurance coverage received.' }, created_at: '2026-09-03T01:29:48.715Z' },
      { id: 'repair-upload', section: 'repair_estimate', filename: '03_Repair_Estimate.docx', processing_status: 'complete', analysis: { summary: 'Repair estimate received.' }, created_at: '2026-09-03T01:30:09.233Z' },
    ];
    mockReadTransactionState.mockResolvedValue({
      packId: 'cre_acquisition',
      room: {
        property_name: 'Hazard Loss Grounding Room',
        workflow_pack_id: 'cre_acquisition',
        deal_type: 'other',
        deal_stage: 'claim_filing',
        checklist_items: checklist,
      },
      recordState: {
        schemaKey: 'cre_acquisition',
        fields: [],
        requiredFields: [],
        requiredCount: 0,
        confirmedCount: 0,
        awaitingRequiredCount: 0,
        conflictRequiredCount: 0,
        notApplicableCount: 0,
        unresolvedConflicts: [],
      },
      readiness: {},
    });
    mockListTasksForRoom.mockResolvedValue([]);
    mockSupabaseFrom.mockImplementation(table => {
      const result = table === 'deal_analyses'
        ? analyses
        : table === 'party_submissions'
          ? completedParticipants('cre_acquisition')
          : [];
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        then: resolve => resolve({ data: result, error: null }),
      };
      return chain;
    });

    const result = await askQuestion(
      'hazard-loss-grounding-room',
      'Which required documents are currently missing? List only documents that are genuinely absent.',
    );

    expect(result.answer).toBe(
      'Currently missing required documents: Damage Assessment Report, Insurance Claim Form. '
        + 'The live room also shows received evidence for: 01_Loss_Documentation.docx, '
        + '02_Insurance_Coverage.docx, 03_Repair_Estimate.docx.',
    );
    expect(result.citedTaskIds).toEqual([]);
    expect(mockOpenAICompletion).not.toHaveBeenCalled();
  });

  test('does not invent missing documents when all required evidence is live', async () => {
    const checklist = [
      { id: 'loss_report', section: 'loss_report', label: 'Loss Report', required: true, status: 'missing' },
      { id: 'insurance_policy', section: 'insurance_policy', label: 'Insurance Policy', required: true, status: 'missing' },
      { id: 'repair_estimate', section: 'repair_estimate', label: 'Repair Estimate', required: true, status: 'missing' },
    ];
    const analyses = [
      { id: 'loss-upload', section: 'loss_report', filename: 'loss-report.pdf', processing_status: 'complete', analysis: { summary: 'Loss report received.' }, created_at: '2026-09-03T01:29:35.077Z' },
      { id: 'policy-upload', section: 'insurance_policy', filename: 'insurance-policy.pdf', processing_status: 'complete', analysis: { summary: 'Insurance policy received.' }, created_at: '2026-09-03T01:29:48.715Z' },
      { id: 'repair-upload', section: 'repair_estimate', filename: 'repair-estimate.pdf', processing_status: 'complete', analysis: { summary: 'Repair estimate received.' }, created_at: '2026-09-03T01:30:09.233Z' },
    ];
    mockReadTransactionState.mockResolvedValue({
      packId: 'cre_acquisition',
      room: {
        property_name: 'Complete Evidence Room',
        workflow_pack_id: 'cre_acquisition',
        deal_type: 'other',
        deal_stage: 'claim_filing',
        checklist_items: checklist,
      },
      recordState: {
        schemaKey: 'cre_acquisition',
        fields: [],
        requiredFields: [],
        requiredCount: 0,
        confirmedCount: 0,
        awaitingRequiredCount: 0,
        conflictRequiredCount: 0,
        notApplicableCount: 0,
        unresolvedConflicts: [],
      },
      readiness: {},
    });
    mockListTasksForRoom.mockResolvedValue([]);
    mockSupabaseFrom.mockImplementation(table => {
      const result = table === 'deal_analyses'
        ? analyses
        : table === 'party_submissions'
          ? completedParticipants('cre_acquisition')
          : [];
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        then: resolve => resolve({ data: result, error: null }),
      };
      return chain;
    });

    const result = await askQuestion('complete-evidence-room', 'What documents are currently missing?');

    expect(result.answer).toBe(
      'No required documents are currently missing. The live room shows received evidence for: '
        + 'loss-report.pdf, insurance-policy.pdf, repair-estimate.pdf.',
    );
    expect(mockOpenAICompletion).not.toHaveBeenCalled();
  });

  test('does not report received required documents as missing when checklist rows are stale', async () => {
    const checklist = [
      {
        id: 'purchase_agreement',
        section: 'legal',
        label: 'Purchase Agreement',
        required: true,
        status: 'missing',
        uploaded: false,
      },
      {
        id: 'disclosure_schedules',
        section: 'legal',
        label: 'Disclosure Schedules',
        required: true,
        status: 'missing',
        uploaded: false,
      },
    ];
    const analyses = [
      {
        id: 'purchase-analysis',
        section: 'legal',
        filename: 'executed-agreement.pdf',
        processing_status: 'complete',
        analysis: { documentType: 'Purchase Agreement', summary: 'Agreement received.' },
        created_at: '2026-09-04T01:29:35.077Z',
        is_active: true,
      },
      {
        id: 'disclosure-analysis',
        section: 'legal',
        filename: 'disclosures.pdf',
        processing_status: 'complete',
        analysis: { documentType: 'Disclosure Schedules', summary: 'Schedules received.' },
        created_at: '2026-09-04T01:29:48.715Z',
        is_active: true,
      },
    ];
    mockReadTransactionState.mockResolvedValue({
      packId: 'business_acquisition',
      room: {
        property_name: 'Canonical document status room',
        workflow_pack_id: 'business_acquisition',
        deal_type: 'business_acquisition',
        deal_stage: 'due_diligence',
        checklist_items: checklist,
      },
      recordState: {
        schemaKey: 'business_acquisition',
        fields: [],
        requiredFields: [],
        requiredCount: 0,
        confirmedCount: 0,
        awaitingRequiredCount: 0,
        conflictRequiredCount: 0,
        notApplicableCount: 0,
        unresolvedConflicts: [],
      },
      readiness: {},
    });
    mockListTasksForRoom.mockResolvedValue([]);
    mockSupabaseFrom.mockImplementation(table => {
      const result = table === 'deal_analyses'
        ? analyses
        : table === 'party_submissions'
          ? completedParticipants('business_acquisition')
          : [];
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        then: resolve => resolve({ data: result, error: null }),
      };
      return chain;
    });

    const result = await askQuestion(
      'canonical-document-status-room',
      'Should this transaction advance from Due Diligence to Closing based on the current document status?',
    );

    expect(result.answer).toContain('No required documents are currently missing.');
    expect(result.answer).not.toContain('Purchase Agreement');
    expect(result.answer).not.toContain('Disclosure Schedules');
    expect(mockOpenAICompletion).not.toHaveBeenCalled();
  });

  test('answers stage advancement from the same canonical blockers used by the coordinator', async () => {
    mockReadTransactionState.mockResolvedValue({
      packId: 'business_acquisition',
      room: {
        property_name: 'Canonical stage decision room',
        workflow_pack_id: 'business_acquisition',
        deal_type: 'business_acquisition',
        deal_stage: 'under_review',
        checklist_items: [{
          id: 'required-document',
          section: 'required-document',
          label: 'Required document',
          required: true,
          documentState: 'missing',
          documentReceived: false,
        }],
      },
      recordState: {
        schemaKey: 'business_acquisition',
        fields: [{ key: 'transaction.value', label: 'Transaction value', status: 'awaiting', value: 'Known value' }],
        requiredFields: [{ key: 'transaction.value', label: 'Transaction value', status: 'awaiting', value: 'Known value' }],
        requiredCount: 1,
        confirmedCount: 0,
        awaitingRequiredCount: 1,
        conflictRequiredCount: 0,
        notApplicableCount: 0,
        unresolvedConflicts: [],
      },
      readiness: { approvalReady: true, fundReleaseReady: true },
    });
    mockListTasksForRoom.mockResolvedValue([]);
    setupSupabaseQueries('business_acquisition');

    const result = await askQuestion(
      'canonical-stage-decision-room',
      'Should this transaction advance to the next stage?',
    );

    expect(result.answer).toContain('No — do not advance');
    expect(result.answer).toContain('Required document');
    expect(result.answer).toContain('Transaction value');
    expect(mockOpenAICompletion).not.toHaveBeenCalled();
  });

  test('clearing the briefing cache makes the next briefing reflect new evidence', async () => {
    const propertyId = 'briefing-cache-room';
    const checklist = [
      { id: 'loss_report', section: 'loss_report', label: 'Loss Report', required: true, status: 'missing' },
    ];
    let analyses = [];
    const recordState = {
      schemaKey: 'cre_acquisition',
      fields: [],
      requiredFields: [],
      requiredCount: 0,
      confirmedCount: 0,
      awaitingRequiredCount: 0,
      conflictRequiredCount: 0,
      notApplicableCount: 0,
    };

    mockReadTransactionState.mockResolvedValue({
      packId: 'cre_acquisition',
      room: {
        property_name: 'Briefing Cache Room',
        workflow_pack_id: 'cre_acquisition',
        deal_type: 'cre_acquisition',
        deal_stage: 'due_diligence',
        checklist_items: checklist,
      },
      recordState,
      readiness: {},
    });
    mockListTasksForRoom.mockResolvedValue([]);
    mockSupabaseFrom.mockImplementation(table => {
      const result = table === 'deal_analyses' ? analyses : completedParticipants('cre_acquisition');
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        then: resolve => resolve({ data: result, error: null }),
      };
      return chain;
    });
    mockOpenAICompletion.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            status: 'on_track',
            statusLabel: 'On Track',
            narrative: 'The workspace is progressing normally.',
            parallelNote: null,
            prepared: [],
          }),
        },
      }],
    });

    clearBriefingCache(propertyId);
    const first = await getBriefing(propertyId);
    expect(first.missingDocuments).toEqual([
      expect.objectContaining({ section: 'loss_report', label: 'Loss Report' }),
    ]);

    analyses = [{
      id: 'loss-upload',
      section: 'loss_report',
      filename: 'loss-report.pdf',
      processing_status: 'extracted',
      analysis: { summary: 'Loss report received.' },
      created_at: '2026-08-31T20:00:00.000Z',
    }];
    expect((await getBriefing(propertyId)).missingDocuments).toHaveLength(1);

    clearBriefingCache(propertyId);
    const second = await getBriefing(propertyId);
    expect(second.missingDocuments).toEqual([]);
    expect(mockOpenAICompletion).toHaveBeenCalledTimes(2);
  });
});