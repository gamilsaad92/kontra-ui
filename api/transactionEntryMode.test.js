const {
  TRANSACTION_ENTRY_MODES,
  historicalLifecycleStage,
  isPreviouslyCompletedRoom,
  normalizeTransactionEntryMode,
} = require('./lib/transactionEntryMode');

// The production checkout intentionally does not carry the API test dependency
// tree. Mock the database-backed collaborators so this regression suite remains
// runnable with the UI Jest binary as well as a full API install.
jest.mock('./db', () => ({ supabase: {} }));
jest.mock('./lib/taskEngine', () => ({ listTasksForRoom: jest.fn() }));
jest.mock('./lib/transactionState', () => ({ readTransactionState: jest.fn() }));
jest.mock('./lib/dealRoomHelpers', () => ({
  DEFAULT_PACK_ID: 'business_acquisition',
  getPackRoleConfig: jest.fn(() => []),
  getPackRoleLabel: jest.fn(() => ''),
  getPackStageConfig: jest.fn(() => ({ stages: [] })),
  getPackStageLabel: jest.fn(() => ''),
}));
jest.mock('./lib/documentStatus', () => ({ projectDocumentChecklist: jest.fn() }));
jest.mock('./lib/documentAssignmentAccess', () => ({
  getChecklistItemAssignedRoles: jest.fn(() => []),
  hasDocumentRole: jest.fn(() => false),
}));
jest.mock('./lib/participantSubmissionState', () => ({
  deriveParticipantSubmissionRows: jest.fn(() => []),
}));
jest.mock('./lib/tokenizationGuidance', () => ({
  isTokenizationQuestion: jest.fn(() => false),
  buildTokenizationGuidance: jest.fn(() => ''),
  buildTokenizationPrompt: jest.fn(() => ''),
  buildTokenizationAnswerPrefix: jest.fn(() => ''),
}));

const { buildPackLifecycle } = require('./lib/operationsManager');
const { buildStageDecision } = require('./lib/stageDecision');

describe('previously completed transaction entry mode', () => {
  test('accepts explicit modes and treats an omitted value as legacy active behavior', () => {
    expect(normalizeTransactionEntryMode()).toBeNull();
    expect(normalizeTransactionEntryMode(TRANSACTION_ENTRY_MODES.ACTIVE)).toBe('active');
    expect(normalizeTransactionEntryMode(TRANSACTION_ENTRY_MODES.PREVIOUSLY_COMPLETED)).toBe('previously_completed');
    expect(() => normalizeTransactionEntryMode('historical')).toThrow(/Invalid transaction entry mode/);
  });

  test('projects a historical room as one non-advancing compatibility state', () => {
    const lifecycle = buildPackLifecycle(
      'business_acquisition',
      'historical_verification',
      null,
      [{ key: 'uploading', label: 'Uploading' }, { key: 'closing', label: 'Closing' }],
      'previously_completed',
    );
    expect(lifecycle).toEqual(expect.objectContaining({
      entryMode: 'previously_completed',
      historical: true,
      currentStageKey: 'historical_verification',
      stages: [historicalLifecycleStage('previously_completed')],
    }));

    const decision = buildStageDecision({
      lifecycle,
      checklist: [{ required: true, documentState: 'missing' }],
      recordState: { requiredFields: [{ key: 'transaction.value', status: 'awaiting' }], conflictRequiredCount: 1 },
      readiness: { approvalReady: false },
      groundedBlockers: [{ sourceType: 'required_participant', label: 'Missing participant' }],
    });
    expect(decision).toEqual(expect.objectContaining({
      status: 'historical_verification',
      recommendationAllowed: false,
      nextStage: null,
      blockers: [],
    }));
  });

  test('only the authoritative mode marks a room historical', () => {
    expect(isPreviouslyCompletedRoom({ transaction_entry_mode: 'previously_completed' })).toBe(true);
    expect(isPreviouslyCompletedRoom({ transaction_entry_mode: null, deal_stage: 'complete' })).toBe(false);
  });
});