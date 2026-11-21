'use strict';

jest.mock('../db', () => {
  const createdRows = [];
  let room = {};
  let customPackConfig = null;
  let existingTasks = [];
  const supabase = {
    __configure(nextRoom, nextPackConfig = null, nextExistingTasks = []) {
      room = nextRoom;
      customPackConfig = nextPackConfig;
      existingTasks = nextExistingTasks;
      createdRows.length = 0;
    },
    __createdRows: createdRows,
    from(table) {
      let inserted = null;
      const query = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        order: jest.fn(() => query),
        maybeSingle: jest.fn(async () => ({
          data: table === 'deal_rooms'
            ? room
            : table === 'custom_workflow_packs' ? { config: customPackConfig } : null,
          error: null,
        })),
        then: (resolve, reject) => Promise.resolve({
          data: table === 'deal_room_tasks' ? existingTasks : [],
          error: null,
        }).then(resolve, reject),
        insert: jest.fn(row => {
          inserted = row;
          createdRows.push(row);
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
jest.mock('./documentVersions', () => ({ selectActiveDocumentVersions: rows => rows }));
jest.mock('./taskSubmissionQuery', () => ({ loadTaskSubmissions: jest.fn() }));
jest.mock('./recordRemediation', () => ({
  getRecordRemediationPlan: jest.fn(() => ({ upsert: [], dismiss: [] })),
}));
jest.mock('./participantCompletion', () => ({ resolveParticipantCompletions: jest.fn(() => []) }));
jest.mock('./transactionState', () => ({ readTransactionState: jest.fn() }));

const { supabase } = require('../db');
const { getRoomPackId } = require('./dealRoomHelpers');
const { loadTaskSubmissions } = require('./taskSubmissionQuery');
const { readTransactionState } = require('./transactionState');
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
    loadTaskSubmissions.mockResolvedValue({ data: [] });
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
});
