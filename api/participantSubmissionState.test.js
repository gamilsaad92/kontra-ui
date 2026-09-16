const {
  syncParticipantSubmissionFromDocument,
} = require('./lib/participantSubmissionState');

describe('participant submission persistence', () => {
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
        status: 'submitted',
        doc_count: 1,
      }),
    ]);
  });
});