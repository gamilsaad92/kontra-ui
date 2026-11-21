'use strict';

const {
  buildChecklistRequirementPlan,
  filterTasksForRoom,
  isDigitalAssetReadinessApplicable,
} = require('./taskRelevance');

describe('transaction-aware task relevance', () => {
  test('does not infer tokenization for an acquisition room without an explicit digital-asset opt-in', () => {
    expect(isDigitalAssetReadinessApplicable({
      property_name: 'Redwood Acquisition',
      workflow_pack_id: 'ws_acquisition',
      deal_type: 'cre_acquisition',
      metadata_values: { digital_asset_enabled: false },
    }, { transactionType: 'cre_acquisition' })).toBe(false);

    expect(isDigitalAssetReadinessApplicable({
      property_name: 'Tokenization support',
      workflow_pack_id: 'cre_acquisition',
      deal_type: 'cre_acquisition',
      metadata_values: {},
    })).toBe(false);
  });

  test('accepts explicit opt-in for mixed workflows, but explicit false overrides pack defaults', () => {
    expect(isDigitalAssetReadinessApplicable({
      workflow_pack_id: 'ws_custom_acquisition',
      deal_type: 'cre_acquisition',
      metadata_values: { digital_asset_enabled: true },
    }, { transactionType: 'cre_acquisition' })).toBe(true);

    expect(isDigitalAssetReadinessApplicable({
      workflow_pack_id: 'tokenization',
      metadata_values: { digital_asset_enabled: 'false' },
    })).toBe(false);

    expect(isDigitalAssetReadinessApplicable({
      workflow_pack_id: 'ws_custom_tokens',
      metadata_values: {},
    }, { transactionType: 'token_issuance' })).toBe(true);
  });

  test('hides only Digital Asset readiness tasks when the room is not eligible', () => {
    const tasks = [
      { id: 'ordinary', task_type: 'missing_document', source_type: 'workflow_checklist' },
      { id: 'readiness', task_type: 'readiness_setup', source_type: 'readiness', category: 'readiness' },
    ];
    expect(filterTasksForRoom(tasks, {
      workflow_pack_id: 'cre_acquisition',
      metadata_values: { digital_asset_enabled: false },
    })).toEqual([tasks[0]]);
  });

  test('builds missing-document tasks from actual required checklist rows and assigns the configured role', () => {
    const plan = buildChecklistRequirementPlan({
      room: { deal_stage: 'due_diligence' },
      checklist: [{
        id: 'title-report',
        label: 'Title Report',
        required: true,
        status: 'pending',
        assignedTo: ['counsel'],
        workflow_stage: 'due_diligence',
      }],
      roleConfig: { roles: [{ key: 'counsel' }] },
    });

    expect(plan.create).toEqual([expect.objectContaining({
      taskType: 'missing_document',
      title: 'Upload Title Report',
      ownerType: 'human',
      ownerRole: 'counsel',
      sourceType: 'workflow_checklist',
      sourceId: 'workflow-checklist:title-report',
      blocking: false,
      severity: 'medium',
      evidence: expect.arrayContaining([
        expect.stringContaining('Active workflow checklist'),
        'Workflow stage: due_diligence.',
      ]),
    })]);
    expect(plan.resolve).toEqual([]);
  });

  test('uses acquisition and tokenization checklists without inventing cross-workflow requirements', () => {
    const acquisition = buildChecklistRequirementPlan({
      room: { deal_stage: 'due_diligence' },
      checklist: [
        { id: 'title', label: 'Title Report', required: true, status: 'pending', assignedTo: ['title_agent'] },
        { id: 'financing', label: 'Financing Commitment', required: true, status: 'pending', assignedTo: ['lender'] },
        { id: 'inspection', label: 'Inspection Report', required: true, status: 'pending', assignedTo: ['inspector'] },
      ],
      roleConfig: { roles: [{ key: 'title_agent' }, { key: 'lender' }, { key: 'inspector' }] },
    });
    expect(acquisition.create.map(task => [task.title, task.ownerRole])).toEqual([
      ['Upload Title Report', 'title_agent'],
      ['Upload Financing Commitment', 'lender'],
      ['Upload Inspection Report', 'inspector'],
    ]);

    const tokenization = buildChecklistRequirementPlan({
      room: { deal_stage: 'structuring' },
      checklist: [
        { id: 'tom', label: 'Token Offering Memorandum', required: true, status: 'pending', assignedTo: ['issuer'] },
        { id: 'eligibility', label: 'Investor Eligibility Evidence', required: true, status: 'pending', assignedTo: ['compliance'] },
      ],
      roleConfig: { roles: [{ key: 'issuer' }, { key: 'compliance' }] },
    });
    expect(tokenization.create.map(task => [task.title, task.ownerRole])).toEqual([
      ['Upload Token Offering Memorandum', 'issuer'],
      ['Upload Investor Eligibility Evidence', 'compliance'],
    ]);
  });

  test('does not create tasks for received documents, future-stage requirements, or already dismissed tasks', () => {
    const plan = buildChecklistRequirementPlan({
      room: { deal_stage: 'due_diligence' },
      checklist: [
        { id: 'uploaded', label: 'Purchase Agreement', required: true, status: 'uploaded' },
        { id: 'future', label: 'Closing Certificate', required: true, status: 'pending', workflow_stage: 'closing' },
        { id: 'dismissed', label: 'Survey', required: true, status: 'pending' },
      ],
      existingTasks: [{
        id: 'dismissed-task',
        task_type: 'missing_document',
        source_type: 'workflow_checklist',
        source_id: 'workflow-checklist:dismissed',
        status: 'dismissed',
      }],
    });

    expect(plan.create).toEqual([]);
    expect(plan.resolve).toEqual([]);
  });

  test('does not duplicate a regulatory document already represented by a readiness task', () => {
    const plan = buildChecklistRequirementPlan({
      room: { deal_stage: 'structuring' },
      checklist: [{
        id: 'regulatory-filing',
        label: 'Regulatory Filing',
        required: true,
        status: 'pending',
      }],
      existingTasks: [{
        id: 'readiness-regulatory-task',
        task_type: 'readiness_document',
        source_type: 'readiness',
        source_document_id: 'regulatory-filing',
        status: 'pending',
      }],
    });

    expect(plan.create).toEqual([]);
  });

  test('prevents duplicate tasks and resolves an open task once its required document arrives', () => {
    const checklist = [{
      id: 'inspection',
      label: 'Inspection Report',
      required: true,
      status: 'uploaded',
    }];
    const existing = [{
      id: 'inspection-task',
      task_type: 'missing_document',
      source_type: 'workflow_checklist',
      source_id: 'workflow-checklist:inspection',
      status: 'pending',
    }];
    const resolved = buildChecklistRequirementPlan({ checklist, existingTasks: existing });
    expect(resolved.create).toEqual([]);
    expect(resolved.resolve).toEqual([{
      task: existing[0],
      status: 'completed',
    }]);

    const stillMissing = buildChecklistRequirementPlan({
      checklist: [{ ...checklist[0], status: 'pending' }],
      existingTasks: [{ ...existing[0], status: 'dismissed' }],
    });
    expect(stillMissing.create).toEqual([]);
  });
});
