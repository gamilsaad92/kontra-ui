const { loadParticipantSubmissions } = require('./lib/participantSubmissionHydration');

function createSupabaseMock(rows) {
  const selects = [];
  return {
    selects,
    from() {
      const query = {
        select(fields) {
          selects.push(fields);
          query.fields = fields;
          return query;
        },
        eq() {
          return query;
        },
        then(resolve) {
          const hasStatus = /\bstatus\b/.test(query.fields || '');
          return resolve({
            data: hasStatus ? null : rows,
            error: hasStatus
              ? { message: 'column party_submissions.status does not exist' }
              : null,
          });
        },
      };
      return query;
    },
  };
}

describe('participant submission schema compatibility', () => {
  test('falls back when production does not expose status', async () => {
    const supabase = createSupabaseMock([{
      role: 'attorney',
      name: 'Legal Advisor',
      doc_count: 1,
      submitted_at: '2026-09-16T01:53:12.000Z',
    }]);

    await expect(loadParticipantSubmissions(supabase, 'harbor-ridge-test'))
      .resolves.toEqual([expect.objectContaining({
        role: 'attorney',
        doc_count: 1,
      })]);
    expect(supabase.selects).toEqual([
      'role, name, status, doc_count, submitted_at',
      'role, name, doc_count, submitted_at',
    ]);
  });
});