const {
  resolveParticipantCompletion,
} = require('./lib/participantCompletion');
const {
  syncParticipantSubmissionFromDocument,
} = require('./lib/participantSubmissionState');

describe('canonical participant completion', () => {
  const role = {
    key: 'attorney',
    label: 'Legal Advisor',
    required: true,
    invitable: true,
  };

  test('joined invite plus accepted assigned document completes without party_submissions', () => {
    const state = resolveParticipantCompletion(role, {
      invites: [{ role_key: 'Legal Advisor', status: 'active' }],
      submissions: [],
      checklist: [{
        id: 'assigned-document',
        required: true,
        assignedTo: ['attorney'],
        status: 'uploaded',
      }],
    });

    expect(state).toEqual(expect.objectContaining({
      role: 'attorney',
      label: 'Legal Advisor',
      joined: true,
      complete: true,
      assignedRequiredDocumentCount: 1,
      completedRequiredDocumentCount: 1,
      completionSource: 'joined_invite_and_assigned_documents',
    }));
  });

  test('joined participant stays incomplete while an assigned requirement is unresolved', () => {
    const state = resolveParticipantCompletion(role, {
      invites: [{ role_key: 'attorney', status: 'joined' }],
      submissions: [],
      checklist: [{
        id: 'assigned-document',
        required: true,
        assignedTo: ['Legal Advisor'],
        status: 'pending',
      }],
    });

    expect(state.complete).toBe(false);
    expect(state.unresolvedRequiredDocumentCount).toBe(1);
  });

  test('participant upload syncs attorney-keyed submission state and clears the canonical blocker sequence', async () => {
    const writes = [];
    const analyses = [{ id: 'legal-dd-report', uploaded_by_role: 'attorney' }];
    const submissions = [];
    const supabase = {
      from(table) {
        const filters = {};
        const query = {
          select: (_fields, options) => {
            query.count = options?.count === 'exact' ? analyses.length : undefined;
            query.head = options?.head === true;
            return query;
          },
          eq: (key, value) => {
            filters[key] = value;
            return query;
          },
          maybeSingle: async () => ({
            data: submissions.find(row =>
              row.property_id === filters.property_id && row.role === filters.role
            ) || null,
            error: null,
          }),
          upsert: (payload) => {
            writes.push(payload);
            const existingIndex = submissions.findIndex(row =>
              row.property_id === payload.property_id && row.role === payload.role
            );
            if (existingIndex >= 0) submissions[existingIndex] = payload;
            else submissions.push(payload);
            return {
              select: () => ({
                maybeSingle: async () => ({ data: payload, error: null }),
              }),
            };
          },
          then: resolve => {
            if (table === 'deal_analyses') {
              return resolve({ data: analyses, count: analyses.length, error: null });
            }
            return resolve({ data: submissions, error: null });
          },
        };
        return query;
      },
    };

    await syncParticipantSubmissionFromDocument({
      supabase,
      propertyId: 'harbor-ridge-test',
      role: 'attorney',
      email: 'legal@example.test',
    });

    expect(writes).toEqual([
      expect.objectContaining({
        property_id: 'harbor-ridge-test',
        role: 'attorney',
        status: 'submitted',
        doc_count: 1,
      }),
    ]);

    const state = resolveParticipantCompletion(role, {
      invites: [{ role_key: 'attorney', status: 'active' }],
      submissions,
      checklist: [{
        id: 'legal_due_diligence_report',
        label: 'Legal Due Diligence Report',
        required: true,
        assignedTo: ['attorney'],
        status: 'ai_complete',
      }],
    });

    expect(state).toEqual(expect.objectContaining({
      label: 'Legal Advisor',
      inviteStatus: 'active',
      submissionStatus: 'submitted',
      joined: true,
      requiredDocumentsComplete: true,
      complete: true,
    }));
  });
});