const {
  buildGroundedBlockers,
  buildStageDecisionAnswer,
} = require('./lib/operationsManager');
const { buildStageDecision } = require('./lib/stageDecision');

const lifecycle = {
  currentStageKey: 'under_review',
  stages: [
    { key: 'under_review', label: 'Under Review' },
    { key: 'approved', label: 'Approved' },
  ],
};

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
});