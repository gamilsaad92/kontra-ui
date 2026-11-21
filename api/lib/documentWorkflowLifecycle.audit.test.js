'use strict';

const { projectDocumentChecklist } = require('./documentStatus');
const { buildChecklistRequirementPlan } = require('./taskRelevance');
const { selectActiveDocumentVersions } = require('./documentVersions');
const { buildAiDocumentClassification } = require('./documentClassification');

const requirement = {
  id: 'title_report',
  section: 'title_report',
  label: 'Title Report',
  required: true,
};

const openTask = {
  id: 'title-report-task',
  task_type: 'missing_document',
  source_type: 'workflow_checklist',
  source_id: 'workflow-checklist:title_report',
  status: 'pending',
};

const completedTask = { ...openTask, status: 'completed' };

function planFor(analyses, existingTasks = [openTask]) {
  return buildChecklistRequirementPlan({
    room: { deal_stage: 'due_diligence' },
    checklist: [requirement],
    activeAnalyses: selectActiveDocumentVersions(analyses),
    documentAnalyses: analyses,
    existingTasks,
  });
}

function analysis(processingStatus, overrides = {}) {
  const validationStatus = processingStatus === 'extracted' ? 'validated' : processingStatus;
  return {
    id: `title-report-${processingStatus}`,
    section: 'title_report',
    processing_status: processingStatus,
    is_active: true,
    created_at: '2026-11-01T00:00:00.000Z',
    analysis: {
      pending: ['uploaded', 'processing', 'retrying'].includes(processingStatus),
      doc_type: 'Title Report',
      document_classification: {
        source: 'ai',
        label: 'Title Report',
        candidates: ['Title Report'],
        ambiguous: false,
        validation_status: validationStatus,
      },
    },
    ...overrides,
  };
}

describe('synthetic end-to-end document workflow audit', () => {
  test('a validated active required document completes its open missing-document task', () => {
    const plan = planFor([analysis('extracted', {
      analysis: { pending: false, doc_type: 'title_report' },
    })]);

    expect(plan.resolve).toEqual([{ task: openTask, status: 'completed' }]);
    expect(plan.create).toEqual([]);
  });

  test('a document stored under an unrelated section does not satisfy the requirement', () => {
    const plan = planFor([{
      id: 'purchase-order',
      section: 'purchase_order',
      processing_status: 'extracted',
      is_active: true,
      analysis: { pending: false, doc_type: 'purchase_order' },
    }]);

    expect(plan.resolve).toEqual([]);
    expect(plan.create).toEqual([]);
    expect(plan.missingSourceIds).toContain(openTask.source_id);
  });

  test('AI classification must agree with the required document section', () => {
    const mismatchedDocument = analysis('extracted', {
      analysis: {
        pending: false,
        doc_type: 'Purchase Order',
        document_classification: {
          source: 'ai',
          label: 'Purchase Order',
          candidates: ['Purchase Order'],
          ambiguous: false,
          validation_status: 'validated',
        },
      },
    });
    const projection = projectDocumentChecklist([requirement], [mismatchedDocument]).items[0];
    const plan = planFor([mismatchedDocument]);

    expect(projection.documentReceived).toBe(false);
    expect(projection.documentState).toBe('needs_review');
    expect(plan.resolve).toEqual([]);
    expect(plan.create).toEqual([]);
  });

  test.each(['uploaded', 'processing', 'retrying', 'failed'])(
    '%s evidence does not satisfy a required document before validation',
    status => {
      const plan = planFor([analysis(status)]);

      expect(plan.resolve).toEqual([]);
      expect(plan.create).toEqual([]);
    },
  );

  test('missing, ambiguous, and contradictory classifications remain outstanding', () => {
    const missing = analysis('extracted', {
      analysis: { pending: false, summary: 'Document uploaded.' },
    });
    const ambiguous = analysis('extracted', {
      analysis: {
        pending: false,
        document_classification: {
          source: 'ai',
          label: null,
          candidates: ['Title Report', 'Purchase Agreement'],
          ambiguous: true,
          validation_status: 'validated',
        },
      },
    });
    const contradictory = buildAiDocumentClassification({
      doc_type: 'Title Report',
      documentType: 'Purchase Agreement',
    }, 'validated');

    expect(planFor([missing]).resolve).toEqual([]);
    expect(planFor([ambiguous]).resolve).toEqual([]);
    expect(contradictory.ambiguous).toBe(true);
    expect(contradictory.label).toBeNull();
  });

  test('filename and upload section alone do not establish document identity', () => {
    const unclassified = analysis('extracted', {
      filename: 'Title Report.pdf',
      analysis: { pending: false, summary: 'An uploaded file.' },
    });
    const projected = projectDocumentChecklist([requirement], [unclassified]).items[0];

    expect(projected.documentReceived).toBe(false);
    expect(projected.documentState).toBe('needs_review');
  });

  test('a failed replacement preserves the prior validated evidence', () => {
    const versions = [
      {
        id: 'accepted-title-report',
        section: 'title_report',
        processing_status: 'extracted',
        is_active: false,
        superseded_at: '2026-11-01T00:00:00.000Z',
        created_at: '2026-10-20T00:00:00.000Z',
        analysis: {
          pending: false,
          doc_type: 'Title Report',
          document_classification: {
            source: 'ai',
            label: 'Title Report',
            candidates: ['Title Report'],
            ambiguous: false,
            validation_status: 'validated',
          },
        },
      },
      analysis('failed', {
        id: 'replacement-title-report',
      }),
    ];
    const plan = planFor(versions, [openTask]);

    expect(plan.create).toEqual([]);
    expect(plan.resolve).toEqual([{ task: openTask, status: 'completed' }]);
  });

  test('a successful replacement becomes the current validated evidence', () => {
    const activeVersions = selectActiveDocumentVersions([
      {
        id: 'old-title-report',
        section: 'title_report',
        processing_status: 'extracted',
        is_active: false,
        superseded_at: '2026-11-01T00:00:00.000Z',
        created_at: '2026-10-20T00:00:00.000Z',
        analysis: {
          pending: false,
          document_classification: {
            source: 'ai',
            label: 'Title Report',
            candidates: ['Title Report'],
            ambiguous: false,
            validation_status: 'validated',
          },
        },
      },
      analysis('extracted', { id: 'replacement-title-report' }),
    ]);
    const plan = planFor(activeVersions, [openTask]);

    expect(plan.resolve).toEqual([{ task: openTask, status: 'completed' }]);
  });

  test('evidence disappearance creates a new task cycle without mutating completion history', () => {
    const plan = planFor([], [completedTask]);

    expect(plan.create).toHaveLength(1);
    expect(plan.create[0].sourceId).toBe(`${openTask.source_id}:cycle:${completedTask.id}`);
    expect(completedTask.status).toBe('completed');
  });

  test('repeated refresh does not duplicate a task reopened for missing evidence', () => {
    const firstPlan = planFor([], [completedTask]);
    const reopenedTask = {
      ...openTask,
      id: 'reopened-title-report-task',
      source_id: firstPlan.create[0].sourceId,
    };
    const secondPlan = planFor([], [completedTask, reopenedTask]);

    expect(firstPlan.create).toHaveLength(1);
    expect(secondPlan.create).toEqual([]);
  });

  test('repeated refresh does not duplicate an open task', () => {
    const plan = planFor([]);

    expect(plan.create).toEqual([]);
    expect(plan.resolve).toEqual([]);
  });

  test('dismissed task history is preserved on refresh', () => {
    const dismissedTask = { ...openTask, status: 'dismissed' };
    const plan = planFor([], [dismissedTask]);

    expect(plan.create).toEqual([]);
    expect(plan.resolve).toEqual([]);
    expect(dismissedTask.status).toBe('dismissed');
  });

  test('a new invalid evidence version after dismissal creates a separate task and preserves dismissal', () => {
    const dismissedTask = {
      ...openTask,
      status: 'dismissed',
      updated_at: '2026-10-30T00:00:00.000Z',
    };
    const failedUpload = {
      ...analysis('failed'),
      id: 'new-failed-version',
      created_at: '2026-11-01T00:00:00.000Z',
    };
    const plan = planFor([failedUpload], [dismissedTask]);

    expect(plan.create).toHaveLength(1);
    expect(plan.create[0].sourceId).toBe(`${openTask.source_id}:evidence:new-failed-version`);
    expect(dismissedTask.status).toBe('dismissed');
  });
});
