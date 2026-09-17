jest.mock('./db', () => ({ supabase: {} }));
jest.mock('./lib/dealRoomHelpers', () => ({
  DEFAULT_PACK_ID: 'business_acquisition',
  getPackRoleConfig: jest.fn(() => ({ roles: [] })),
  getPackRoleLabel: jest.fn(role => role),
  getPackStageConfig: jest.fn(() => ({ stages: [] })),
  getPackStageLabel: jest.fn(stage => stage),
}));
jest.mock('./lib/taskEngine', () => ({
  listTasksForRoom: jest.fn(),
}));
jest.mock('./lib/transactionState', () => ({
  readTransactionState: jest.fn(),
}));
jest.mock('./lib/documentStatus', () => ({
  projectDocumentChecklist: jest.fn(() => ({
    items: [],
    activeAnalyses: [],
    missingDocuments: [],
  })),
}));
jest.mock('./lib/documentAssignmentAccess', () => ({
  getChecklistItemAssignedRoles: jest.fn(() => []),
  hasDocumentRole: jest.fn(() => false),
}));
jest.mock('./lib/participantSubmissionState', () => ({
  deriveParticipantSubmissionRows: jest.fn(() => []),
}));
jest.mock('./lib/tokenizationGuidance', () => ({
  isTokenizationQuestion: jest.fn(() => false),
  buildTokenizationGuidance: jest.fn(),
  buildTokenizationPrompt: jest.fn(),
  buildTokenizationAnswerPrefix: jest.fn(),
}));

const {
  buildGroundedBlockers,
  buildStageDecisionAnswer,
  classifyStageDecisionQuestion,
} = require('./lib/operationsManager');
const { buildStageDecision } = require('./lib/stageDecision');

const lifecycle = {
  currentStageKey: 'under_review',
  stages: [
    { key: 'under_review', label: 'Under Review' },
    { key: 'approved', label: 'Approved' },
  ],
};

const closingLifecycle = {
  currentStageKey: 'due_diligence',
  stages: [
    { key: 'due_diligence', label: 'Due Diligence' },
    { key: 'closing', label: 'Closing' },
  ],
};

function buildFifteenBlockerDecision() {
  const requiredDocuments = [
    'Financial Due Diligence Report',
    'Tax Due Diligence Report',
    'Operational Due Diligence Report',
    'Insurance Due Diligence Report',
    'Commercial Due Diligence Report',
    'Financing Verification Documents',
    'Closing Conditions Checklist',
    'Final Closing Documentation',
  ].map((label, index) => ({
    id: `required-document-${index}`,
    section: `required-document-${index}`,
    label,
    required: true,
    documentState: 'missing',
    documentReceived: false,
  }));
  const requiredFields = [
    'Due Diligence Requirements',
    'Financing Sources',
    'Working Capital Adjustments',
  ].map((label, index) => ({
    key: `record-field-${index}`,
    label,
    status: 'missing',
  }));
  const groundedBlockers = [
    {
      sourceType: 'required_participant',
      role: 'financial_advisor',
      label: 'Financial Advisor',
      evidence: ['No submission has been received for the Financial Advisor role.'],
    },
    {
      sourceType: 'required_participant',
      role: 'lender',
      label: 'Lender',
      evidence: ['No submission has been received for the Lender role.'],
    },
    {
      sourceType: 'explicit_blocking_task',
      taskId: 'lender-task',
      label: 'Lender has not submitted required documents yet',
      evidence: ['The Lender submission remains incomplete.'],
    },
    {
      sourceType: 'explicit_blocking_task',
      taskId: 'financial-advisor-task',
      label: 'Financial Advisor has not submitted required documents yet',
      evidence: ['The Financial Advisor submission remains incomplete.'],
    },
  ];

  return buildStageDecision({
    lifecycle: closingLifecycle,
    checklist: requiredDocuments,
    recordState: {
      requiredFields,
      conflictRequiredCount: 0,
    },
    readiness: { approvalReady: true },
    groundedBlockers,
  });
}

describe('canonical digital-asset readiness applicability', () => {
  test('preserves readiness metadata through grounded blocker projection and excludes it from lifecycle gating', () => {
    const [groundedBlocker] = buildGroundedBlockers({
      packId: 'business_acquisition',
      recordState: { requiredFields: [], conflictRequiredCount: 0 },
      missingDocuments: [],
      participants: [],
      participantDefinitions: [],
      tasks: [{
        id: 'readiness-task',
        task_type: 'readiness_setup',
        title: 'Set token price',
        status: 'pending',
        blocking: true,
        source_type: 'readiness',
        category: 'readiness',
        applicability: 'digital_asset_preparation',
        evidence: ['Token price is not configured.'],
      }],
    });

    expect(groundedBlocker).toEqual(expect.objectContaining({
      sourceType: 'explicit_blocking_task',
      taskId: 'readiness-task',
      taskType: 'readiness_setup',
      taskSourceType: 'readiness',
      taskCategory: 'readiness',
      taskApplicability: 'digital_asset_preparation',
    }));

    const decision = buildStageDecision({
      lifecycle,
      checklist: [],
      recordState: { requiredFields: [], conflictRequiredCount: 0 },
      readiness: { approvalReady: true, digitalAssetEnabled: true },
      groundedBlockers: [groundedBlocker],
    });

    expect(decision.recommendationAllowed).toBe(true);
    expect(decision.blockers).toEqual([]);
  });

  test('keeps an applicable lifecycle blocker and exposes only the corrected canonical set to the deterministic answer', () => {
    const decision = buildStageDecision({
      lifecycle,
      checklist: [],
      recordState: { requiredFields: [], conflictRequiredCount: 0 },
      readiness: { approvalReady: true },
      groundedBlockers: [{
        sourceType: 'explicit_blocking_task',
        taskId: 'lifecycle-task',
        taskType: 'document_review',
        taskSourceType: 'transaction_workflow',
        taskCategory: 'document',
        label: 'Review the required transaction document',
        status: 'pending',
        evidence: ['The required transaction document needs review.'],
      }, {
        sourceType: 'explicit_blocking_task',
        taskId: 'readiness-task',
        taskType: 'readiness_setup',
        taskSourceType: 'readiness',
        taskCategory: 'readiness',
        label: 'Set token price',
        status: 'pending',
        evidence: ['Token price is not configured.'],
      }],
    });

    expect(decision.blockers).toEqual([
      expect.objectContaining({
        taskId: 'lifecycle-task',
        label: 'Review the required transaction document',
      }),
    ]);
    expect(buildStageDecisionAnswer({ stageDecision: decision })).toContain(
      'Review the required transaction document',
    );
    expect(buildStageDecisionAnswer({ stageDecision: decision })).not.toContain('Set token price');
  });

  test('uses one canonical stage decision for eligibility, comprehensive, and actionable lifecycle answers', () => {
    const decision = buildFifteenBlockerDecision();
    expect(decision.blockers).toHaveLength(15);

    const eligibilityQuestion = 'Is Harbor Ridge ready to advance to Closing?';
    const comprehensiveQuestion = 'What are all the requirements currently blocking Harbor Ridge from advancing to Closing?';
    const actionableQuestion = 'What would need to happen before Harbor Ridge can advance to Closing?';

    expect(classifyStageDecisionQuestion(eligibilityQuestion)).toBe('eligibility');
    expect(classifyStageDecisionQuestion(comprehensiveQuestion)).toBe('comprehensive_blockers');
    expect(classifyStageDecisionQuestion(actionableQuestion)).toBe('actionable_requirements');

    const eligibilityAnswer = buildStageDecisionAnswer({
      stageDecision: decision,
    }, classifyStageDecisionQuestion(eligibilityQuestion));
    expect(eligibilityAnswer).toMatch(/^No — do not advance/);
    expect(eligibilityAnswer).toContain('Financial Due Diligence Report');
    expect(eligibilityAnswer).not.toContain('Final Closing Documentation');

    const completeLabels = decision.blockers.map(blocker => blocker.label);
    const comprehensiveAnswer = buildStageDecisionAnswer({
      stageDecision: decision,
    }, classifyStageDecisionQuestion(comprehensiveQuestion));
    expect(comprehensiveAnswer).toContain('Requirements currently blocking advancement');
    completeLabels.forEach(label => expect(comprehensiveAnswer).toContain(label));

    const actionableAnswer = buildStageDecisionAnswer({
      stageDecision: decision,
    }, classifyStageDecisionQuestion(actionableQuestion));
    expect(actionableAnswer).toMatch(/^Before advancing from Due Diligence to Closing, complete these requirements:/);
    expect(actionableAnswer).not.toContain('No — do not advance');
    completeLabels.forEach(label => expect(actionableAnswer).toContain(label));
  });
});