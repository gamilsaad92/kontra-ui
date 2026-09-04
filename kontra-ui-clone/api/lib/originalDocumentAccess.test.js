const { loadOriginalDocument } = require('./originalDocumentAccess');

function makeClient(results) {
  const selects = [];
  let index = 0;
  const client = {
    from() {
      const query = {
        select(columns) {
          selects.push(columns);
          return query;
        },
        eq() {
          return query;
        },
        maybeSingle: async () => results[index++],
      };
      return query;
    },
  };
  return { client, selects };
}

describe('original document lookup', () => {
  test('uses the version-aware projection when available', async () => {
    const { client, selects } = makeClient([{
      data: { id: 'doc-1', property_id: 'room-1', storage_path: 'room-1/insurance/file.pdf', is_active: true },
      error: null,
    }]);

    const result = await loadOriginalDocument(client, 'room-1', 'doc-1');

    expect(result.data.storage_path).toBe('room-1/insurance/file.pdf');
    expect(selects).toHaveLength(1);
    expect(selects[0]).toContain('is_active');
  });

  test('falls back to the legacy projection when version columns are unavailable', async () => {
    const { client, selects } = makeClient([
      { data: null, error: { message: 'column deal_analyses.is_active does not exist' } },
      { data: { id: 'doc-1', property_id: 'room-1', storage_path: 'room-1/insurance/file.pdf' }, error: null },
    ]);

    const result = await loadOriginalDocument(client, 'room-1', 'doc-1');

    expect(result.data.storage_path).toBe('room-1/insurance/file.pdf');
    expect(selects).toHaveLength(2);
    expect(selects[1]).not.toContain('is_active');
    expect(selects[1]).toContain('storage_path');
  });

  test('does not hide unrelated lookup failures behind a legacy retry', async () => {
    const { client, selects } = makeClient([
      { data: null, error: { message: 'permission denied for table deal_analyses' } },
    ]);

    const result = await loadOriginalDocument(client, 'room-1', 'doc-1');

    expect(result.error.message).toContain('permission denied');
    expect(selects).toHaveLength(1);
  });
});