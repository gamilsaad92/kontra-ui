'use strict';

const { projectDocumentChecklist } = require('./documentStatus');
const { resolveParticipantCompletion } = require('./participantCompletion');

const requirement = {
  id: 'title-report',
  section: 'title_report',
  label: 'Title Report',
  required: true,
  status: 'uploaded',
  uploaded: true,
  assignedTo: ['buyer'],
};

function validatedVersion(overrides = {}) {
  return {
    id: 'title-report-v1',
    section: 'title_report',
    processing_status: 'extracted',
    is_active: true,
    created_at: '2026-11-01T00:00:00.000Z',
    analysis: {
      doc_type: 'Title Report',
      document_classification: {
        source: 'ai',
        label: 'Title Report',
        candidates: ['Title Report'],
        ambiguous: false,
        validation_status: 'validated',
      },
    },
    ...overrides,
  };
}

function completionFor(analyses) {
  const checklist = projectDocumentChecklist([requirement], analyses).items;
  return resolveParticipantCompletion(
    { key: 'buyer', label: 'Buyer', required: true },
    {
      checklist,
      invites: [{ role_key: 'buyer', status: 'active' }],
    },
  );
}

describe('participant checklist completion validation', () => {
  test.each(['uploaded', 'processing', 'failed'])(
    '%s evidence cannot complete an assigned document requirement',
    processingStatus => {
      const result = completionFor([validatedVersion({
        processing_status: processingStatus,
        analysis: {
          pending: processingStatus !== 'failed',
          document_classification: {
            source: 'ai',
            label: 'Title Report',
            candidates: ['Title Report'],
            ambiguous: false,
            validation_status: processingStatus,
          },
        },
      })]);

      expect(result.complete).toBe(false);
      expect(result.completedRequiredDocumentCount).toBe(0);
      expect(result.unresolvedRequiredDocumentCount).toBe(1);
    },
  );

  test('a validated matching document completes only the participant assigned to it', () => {
    const buyer = completionFor([validatedVersion()]);
    const seller = resolveParticipantCompletion(
      { key: 'seller', label: 'Seller', required: true },
      {
        checklist: projectDocumentChecklist([requirement], [validatedVersion()]).items,
        invites: [{ role_key: 'seller', status: 'active' }],
      },
    );

    expect(buyer.complete).toBe(true);
    expect(buyer.completedRequiredDocumentCount).toBe(1);
    expect(seller.complete).toBe(true);
    expect(seller.assignedRequiredDocumentCount).toBe(0);
  });

  test('a validated document with the wrong class does not complete the assigned requirement', () => {
    const result = completionFor([validatedVersion({
      analysis: {
        document_classification: {
          source: 'ai',
          label: 'Purchase Agreement',
          candidates: ['Purchase Agreement'],
          ambiguous: false,
          validation_status: 'validated',
        },
      },
    })]);

    expect(result.complete).toBe(false);
    expect(result.completedRequiredDocumentCount).toBe(0);
  });

  test('projected missing evidence overrides raw uploaded flags for participant completion', () => {
    const result = resolveParticipantCompletion(
      { key: 'buyer', label: 'Buyer', required: true },
      {
        checklist: [{
          ...requirement,
          documentReceived: false,
          documentState: 'needs_review',
        }],
        invites: [{ role_key: 'buyer', status: 'active' }],
      },
    );

    expect(result.complete).toBe(false);
    expect(result.completedRequiredDocumentCount).toBe(0);
  });
});
