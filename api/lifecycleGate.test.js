const { getLifecycleTransitionGate } = require('./lib/lifecycleGate');

describe('lifecycle transition gate', () => {
  const stages = [
    { key: 'due_diligence', label: 'Due Diligence' },
    {
      key: 'closing',
      label: 'Closing',
      requiredRoles: ['financial_advisor', 'lender'],
    },
  ];

  test('blocks a mixed due-diligence state before closing', () => {
    const documents = Array.from({ length: 11 }, (_, index) => ({
      id: `document-${index + 1}`,
      label: `Required Document ${index + 1}`,
      section: `document_${index + 1}`,
      required: true,
    }));
    const gate = getLifecycleTransitionGate({
      stages,
      currentStage: stages[0],
      nextStage: stages[1],
      requiredDocuments: documents,
      receivedDocuments: documents.slice(0, 3),
      requiredFields: Array.from({ length: 16 }, (_, index) => ({
        key: `transaction.field_${index + 1}`,
        label: `Required Field ${index + 1}`,
        required: true,
        status: index < 13 ? 'confirmed' : 'missing',
      })),
      participantStates: [
        { key: 'financial_advisor', label: 'Financial Advisor', required: true, invited: false, complete: false },
        { key: 'lender', label: 'Lender', required: false, invited: true, complete: false },
      ],
    });

    expect(gate.eligible).toBe(false);
    expect(gate.blockers.map(blocker => blocker.type)).toEqual(expect.arrayContaining([
      'document',
      'record',
      'participant',
    ]));
  });

  test('allows closing once all required inputs are satisfied', () => {
    const documents = [
      { id: 'purchase-agreement', label: 'Purchase Agreement', section: 'purchase_agreement', required: true },
      { id: 'financials', label: 'Financials', section: 'financials', required: true },
    ];
    const gate = getLifecycleTransitionGate({
      stages,
      currentStage: stages[0],
      nextStage: stages[1],
      requiredDocuments: documents,
      receivedDocuments: documents,
      requiredFields: [
        { key: 'transaction.value', label: 'Transaction value', required: true, status: 'confirmed' },
      ],
      participantStates: [
        { key: 'financial_advisor', label: 'Financial Advisor', required: true, invited: true, complete: true },
        { key: 'lender', label: 'Lender', required: false, invited: true, complete: true },
      ],
    });

    expect(gate).toEqual(expect.objectContaining({
      ready: true,
      eligible: true,
      blockers: [],
    }));
  });
});