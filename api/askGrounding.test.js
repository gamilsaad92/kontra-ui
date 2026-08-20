const workflowStages = require('../../shared/workflowStages.json');
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

const { askQuestion, buildGroundedContext } = require('./lib/operationsManager');

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
});