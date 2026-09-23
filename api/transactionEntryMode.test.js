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
const { validateProposal } = require('./lib/transactionRoomGenerator');

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

  test('allows exactly one historical proposal stage without weakening active validation', () => {
    const base = {
      transaction: { title: 'Completed transaction', category: 'business_acquisition' },
      participants: [{ role: 'owner', label: 'Owner' }],
      requirements: [],
      transaction_record_fields: [],
    };
    const historical = validateProposal({
      ...base,
      transaction: { ...base.transaction, entry_mode: 'previously_completed' },
      stages: [{ key: 'historical_verification', name: 'Historical Verification' }],
    });
    expect(historical).toEqual({ ok: true, errors: [] });

    const active = validateProposal({
      ...base,
      stages: [{ key: 'closing', name: 'Closing' }],
    });
    expect(active.ok).toBe(false);
    expect(active.errors).toContain('At least two stages are required');

    const historicalWithSecondStage = validateProposal({
      ...base,
      transaction: { ...base.transaction, entry_mode: 'previously_completed' },
      stages: [
        { key: 'historical_verification', name: 'Historical Verification' },
        { key: 'verified_asset', name: 'Verified Asset' },
      ],
    });
    expect(historicalWithSecondStage.ok).toBe(false);
    expect(historicalWithSecondStage.errors).toContain('Previously completed proposals require exactly one stage');
  });
});
