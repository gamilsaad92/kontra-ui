const { buildStageDecision } = require('./lib/stageDecision');

describe('canonical stage decision', () => {
  const lifecycle = {
    currentStageKey: 'under_review',
    stages: [
      { key: 'under_review', label: 'Under Review' },
      { key: 'approved', label: 'Approved' },
    ],
  };

  test('does not recommend advancement when a milestone document exists but material blockers remain', () => {
    const decision = buildStageDecision({
      lifecycle,
      checklist: [
        {
          id: 'milestone-document',
          section: 'milestone-document',
          label: 'Milestone document',
          required: true,
          documentState: 'received',
          documentReceived: true,
        },
        {
          id: 'required-document',
          section: 'required-document',
          label: 'Required document',
          required: true,
          documentState: 'missing',
          documentReceived: false,
        },
      ],
      recordState: {
        requiredFields: [
          { key: 'transaction.value', label: 'Transaction value', status: 'awaiting' },
        ],
        conflictRequiredCount: 0,
      },
      readiness: { approvalReady: true },
      groundedBlockers: [],
    });

    expect(decision.recommendationAllowed).toBe(false);
    expect(decision.blockers.map(blocker => blocker.sourceType)).toEqual(
      expect.arrayContaining(['required_document', 'transaction_record']),
    );
  });

  test('allows advancement when required documents and record conditions are satisfied', () => {
    const decision = buildStageDecision({
      lifecycle,
      checklist: [
        {
          id: 'required-document',
          section: 'required-document',
          label: 'Required document',
          required: true,
          documentState: 'received',
          documentReceived: true,
        },
      ],
      recordState: {
        requiredFields: [
          { key: 'transaction.value', label: 'Transaction value', status: 'confirmed' },
        ],
        conflictRequiredCount: 0,
      },
      readiness: { approvalReady: true },
      groundedBlockers: [],
    });

    expect(decision).toEqual(expect.objectContaining({
      recommendationAllowed: true,
      status: 'ready',
      nextStage: lifecycle.stages[1],
    }));
  });

  test('keeps the decision advisory so owner overrides remain outside the recommendation gate', () => {
    const decision = buildStageDecision({
      lifecycle,
      checklist: [],
      recordState: { requiredFields: [], conflictRequiredCount: 0 },
      readiness: { approvalReady: true },
      groundedBlockers: [],
    });

    expect(decision.recommendationAllowed).toBe(true);
    expect(decision).not.toHaveProperty('overrideDenied');
  });
});