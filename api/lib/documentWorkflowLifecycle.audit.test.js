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
  ai: true,
};
const receiptRequirement = { ...requirement, ai: false };

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

function planForRequirement(analyses, checklistItem, existingTasks = [openTask]) {
  return buildChecklistRequirementPlan({
    room: { deal_stage: 'due_diligence' },
    checklist: [checklistItem],
    activeAnalyses: selectActiveDocumentVersions(analyses),
    documentAnalyses: analyses,
    existingTasks,
  });
}

function receiptAnalysis(processingStatus, overrides = {}) {
  return {
    id: `receipt-title-report-${processingStatus}`,
    section: 'title_report',
    filename: 'Title Report.pdf',
    storage_path: 'deal-rooms/synthetic/title-report.pdf',
    processing_status: processingStatus,
    is_active: true,
    created_at: '2026-11-01T00:00:00.000Z',
    analysis: {
      pending: ['uploaded', 'processing', 'retrying', 'analyzing'].includes(processingStatus),
      summary: 'Document received.',
    },
    ...overrides,
  };
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
    const plan = planFor([analysis('extracted')]);

    expect(plan.resolve).toEqual([expect.objectContaining({
      task: openTask,
      status: 'completed',
      documentEvidenceType: 'ai_classification_match',
      completionEvidence: expect.stringContaining('passed classification validation'),
    })]);
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
    const documentProjection = projectDocumentChecklist([requirement], [mismatchedDocument]);
    const projection = documentProjection.items[0];
    const plan = planFor([mismatchedDocument]);

    expect(projection.documentReceived).toBe(false);
    expect(projection.documentState).toBe('needs_review');
    expect(documentProjection.activeDocumentStates[0]).toMatchObject({
      documentEvidenceType: 'classification_mismatch',
      documentValidationStatus: 'mismatch',
      documentAiClassificationValidated: true,
    });
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
    expect(plan.resolve).toEqual([expect.objectContaining({
      task: openTask,
      status: 'completed',
      documentEvidenceType: 'ai_classification_match',
    })]);
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

    expect(plan.resolve).toEqual([expect.objectContaining({
      task: openTask,
      status: 'completed',
      documentEvidenceType: 'ai_classification_match',
    })]);
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

  describe.each([
    ['AI-classified', requirement, analysis, 'ai_classification_match'],
    ['receipt-only', receiptRequirement, receiptAnalysis, 'upload_receipt'],
  ])('%s checklist requirement', (_label, checklistItem, makeAnalysis, expectedEvidenceType) => {
    test('successful processing satisfies the checklist with explicit evidence provenance', () => {
      const uploaded = makeAnalysis('extracted');
      const documentProjection = projectDocumentChecklist([checklistItem], [uploaded]);
      const projected = documentProjection.items[0];
      const plan = planForRequirement([uploaded], checklistItem);

      expect(projected).toMatchObject({
        documentState: 'received',
        documentReceived: true,
        documentEvidenceType: expectedEvidenceType,
        documentAiClassificationValidated: expectedEvidenceType === 'ai_classification_match',
      });
      expect(plan.resolve).toEqual([expect.objectContaining({
        task: openTask,
        status: 'completed',
        documentEvidenceType: expectedEvidenceType,
      })]);
      expect(plan.resolve[0].completionEvidence).toContain(
        expectedEvidenceType === 'upload_receipt'
          ? 'contents were not AI-validated'
          : 'passed classification validation',
      );

      if (expectedEvidenceType === 'upload_receipt') {
        expect(uploaded.analysis.document_classification).toBeUndefined();
        expect(projected.documentValidationStatus).toBe('not_required');
        expect(documentProjection.activeDocumentStates[0]).toMatchObject({
          documentEvidenceType: 'upload_receipt',
          documentValidationStatus: 'not_required',
          documentAiClassificationValidated: false,
        });
      } else {
        expect(projected.documentValidationStatus).toBe('classification_validated');
      }
    });

    test.each(['uploaded', 'processing'])(
      '%s uploads do not satisfy the checklist or complete its task',
      status => {
        const uploaded = makeAnalysis(status);
        const plan = planForRequirement([uploaded], checklistItem);
        const projected = projectDocumentChecklist([checklistItem], [uploaded]).items[0];

        expect(projected.documentReceived).toBe(false);
        expect(plan.resolve).toEqual([]);
      },
    );

    test('failed uploads do not satisfy the checklist or complete its task', () => {
      const failed = makeAnalysis('failed');
      const plan = planForRequirement([failed], checklistItem);
      const projected = projectDocumentChecklist([checklistItem], [failed]).items[0];

      expect(projected.documentReceived).toBe(false);
      expect(projected.documentValidationStatus).toBe('failed');
      expect(plan.resolve).toEqual([]);
    });

    test.each(['processing', 'failed'])(
      'a %s replacement preserves the prior successful evidence',
      replacementStatus => {
        const prior = makeAnalysis('extracted', {
          id: 'previous-successful-version',
          is_active: false,
          superseded_at: '2026-11-02T00:00:00.000Z',
          created_at: '2026-10-31T00:00:00.000Z',
        });
        const replacement = makeAnalysis(replacementStatus, {
          id: 'failed-replacement',
          created_at: '2026-11-02T00:00:00.000Z',
        });
        const plan = planForRequirement([prior, replacement], checklistItem);
        const projected = projectDocumentChecklist(
          [checklistItem],
          [prior, replacement],
        ).items[0];

        expect(projected).toMatchObject({
          documentReceived: true,
          documentEvidenceType: expectedEvidenceType,
        });
        expect(plan.resolve).toEqual([expect.objectContaining({
          status: 'completed',
          documentEvidenceType: expectedEvidenceType,
        })]);
      },
    );

    test('a successful replacement becomes the current checklist evidence', () => {
      const prior = makeAnalysis('extracted', {
        id: 'previous-successful-version',
        is_active: false,
        superseded_at: '2026-11-02T00:00:00.000Z',
        created_at: '2026-10-31T00:00:00.000Z',
      });
      const replacement = makeAnalysis('extracted', {
        id: 'successful-replacement',
        created_at: '2026-11-03T00:00:00.000Z',
      });
      const projected = projectDocumentChecklist(
        [checklistItem],
        [prior, replacement],
      );
      const plan = planForRequirement([prior, replacement], checklistItem);

      expect(projected.activeAnalyses.map(item => item.id)).toEqual(['successful-replacement']);
      expect(projected.items[0]).toMatchObject({
        documentReceived: true,
        documentEvidenceType: expectedEvidenceType,
      });
      expect(plan.resolve).toEqual([expect.objectContaining({
        status: 'completed',
        documentEvidenceType: expectedEvidenceType,
      })]);
    });

    test('evidence disappearance opens a new task cycle without changing completed history', () => {
      const completed = { ...completedTask };
      const failed = makeAnalysis('failed');
      const plan = planForRequirement([failed], checklistItem, [completed]);

      expect(plan.create).toHaveLength(1);
      expect(plan.create[0].sourceId).toBe(`${openTask.source_id}:cycle:${completed.id}`);
      expect(completed.status).toBe('completed');
    });
  });

  test('receipt-only evidence requires storage and an exact checklist section', () => {
    const missingStorage = receiptAnalysis('extracted', { storage_path: null });
    const wrongSection = receiptAnalysis('extracted', { section: 'another_section' });

    for (const uploaded of [missingStorage, wrongSection]) {
      const projected = projectDocumentChecklist([receiptRequirement], [uploaded]).items[0];
      expect(projected.documentReceived).toBe(false);
      expect(projected.documentAiClassificationValidated).toBe(false);
    }
  });

  test('receipt evidence does not reopen or rewrite a dismissed task', () => {
    const dismissed = { ...openTask, status: 'dismissed' };
    const receipt = receiptAnalysis('extracted');
    const plan = planForRequirement([receipt], receiptRequirement, [dismissed]);

    expect(plan.create).toEqual([]);
    expect(plan.resolve).toEqual([]);
    expect(dismissed.status).toBe('dismissed');
  });
});
