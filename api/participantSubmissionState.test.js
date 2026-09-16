const {
  deriveParticipantSubmissionRows,
  syncParticipantSubmissionFromDocument,
} = require('./lib/participantSubmissionState');

describe('participant submission persistence', () => {
  test('derives legacy participant presence from active role-tagged evidence without writing a row', () => {
    const rows = deriveParticipantSubmissionRows([], [
      {
        id: 'buyer-questionnaire',
        section: 'buyer_due_diligence_questionnaire',
        uploaded_by_role: 'buyer',
        processing_status: 'extracted',
        created_at: '2026-09-16T10:00:00.000Z',
      },
      {
        id: 'buyer-management-confirmation',
        section: 'buyer_management_confirmation',
        uploaded_by_role: 'buyer',
        processing_status: 'complete',
        created_at: '2026-09-16T11:00:00.000Z',
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        role: 'buyer',
        doc_count: 2,
        submitted_at: '2026-09-16T11:00:00.000Z',
        submissionSource: 'role_uploaded_evidence',
      }),
    ]);
  });

  test('synchronizes an attorney-keyed submission after a successful participant upload', async () => {
    const analyses = [{ id: 'legal-dd-report', uploaded_by_role: 'attorney' }];
    const submissions = [];
    const writes = [];
    const supabase = {
      from(table) {
        const filters = {};
        const query = {
          select: (_fields, options) => {
            query.count = options?.count === 'exact' ? analyses.length : undefined;
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
          upsert: payload => {
            writes.push(payload);
            submissions.push(payload);
            return {
              select: () => ({
                maybeSingle: async () => ({ data: payload, error: null }),
              }),
            };
          },
          then: resolve => resolve({
            data: table === 'deal_analyses' ? analyses : submissions,
            count: table === 'deal_analyses' ? analyses.length : undefined,
            error: null,
          }),
        };
        return query;
      },
    };

    await syncParticipantSubmissionFromDocument({
      supabase,
      propertyId: 'harbor-ridge-production-regression',
      role: 'attorney',
      email: 'legal@example.test',
    });

    expect(writes).toEqual([
      expect.objectContaining({
        property_id: 'harbor-ridge-production-regression',
        role: 'attorney',
        doc_count: 1,
      }),
    ]);
    expect(writes[0]).not.toHaveProperty('status');
  });
});