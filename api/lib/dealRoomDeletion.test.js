const { deleteDealRoomData } = require('./dealRoomDeletion');

function createFakeClient({ failRemove = false } = {}) {
  const roomId = 'room-1';
  const tables = {
    deal_analyses: [{ id: 'analysis-1', property_id: roomId, storage_path: `${roomId}/source.pdf` }],
    deal_room_documents: [],
    digital_asset_preparation_pdf_artifacts: [{
      id: 'pdf-1',
      property_id: roomId,
      storage_bucket: 'deal-documents',
      storage_path: 'archive/room-preparation.pdf',
    }],
    deal_room_invites: [{ id: 'invite-1', property_id: roomId }],
    deal_room_invites_v2: [{ id: 'invite-v2-1', room_id: roomId }],
    deal_room_participants: [{ id: 'participant-1', room_id: roomId }],
    deal_rooms: [{ property_id: roomId }],
  };
  const storageObjects = new Map([
    ['deal-documents', new Set([`${roomId}/source.pdf`, `${roomId}/nested/preparation.pdf`, 'archive/room-preparation.pdf', 'other-room/private.pdf'])],
    ['deal-room-documents', new Set()],
  ]);
  const operations = [];

  function matches(row, filters) {
    return filters.every(({ type, column, value }) => (
      type === 'eq' ? row[column] === value : value.includes(row[column])
    ));
  }

  function query(table) {
    let mode = 'select';
    const filters = [];
    const chain = {
      select: () => { mode = 'select'; return chain; },
      delete: () => { mode = 'delete'; return chain; },
      eq: (column, value) => { filters.push({ type: 'eq', column, value }); return chain; },
      in: (column, value) => { filters.push({ type: 'in', column, value }); return chain; },
      then: (resolve, reject) => {
        Promise.resolve().then(() => {
          const rows = tables[table] || [];
          const matching = rows.filter(row => matches(row, filters));
          if (mode === 'delete') {
            operations.push({ table, filters });
            tables[table] = rows.filter(row => !matches(row, filters));
          }
          return resolve({ data: matching, error: null });
        }).catch(reject);
      },
    };
    return chain;
  }

  function storageBucket(bucket) {
    if (!storageObjects.has(bucket)) storageObjects.set(bucket, new Set());
    const objects = storageObjects.get(bucket);
    return {
      list: async (prefix) => {
        const children = new Map();
        for (const path of objects) {
          if (!path.startsWith(`${prefix}/`)) continue;
          const remainder = path.slice(prefix.length + 1);
          const [name, ...rest] = remainder.split('/');
          if (rest.length) children.set(name, { name, id: null, metadata: null });
          else children.set(name, { name, id: `file-${name}`, metadata: {} });
        }
        return { data: [...children.values()], error: null };
      },
      remove: async (paths) => {
        if (failRemove) return { data: null, error: { message: 'storage unavailable' } };
        for (const path of paths) objects.delete(path);
        return { data: paths.map(path => ({ name: path })), error: null };
      },
    };
  }

  return {
    client: {
      from: query,
      storage: { from: storageBucket },
    },
    operations,
    storageObjects,
  };
}

describe('deal room deletion', () => {
  test('removes room-scoped data and verifies storage before deleting the room', async () => {
    const fake = createFakeClient();
    const result = await deleteDealRoomData('room-1', fake.client);

    expect(result.complete).toBe(true);
    expect(result.preserved).toEqual(expect.arrayContaining([
      'deal_room_audit_log',
      'verified_asset_snapshots',
    ]));
    expect(fake.storageObjects.get('deal-documents')).toEqual(new Set(['other-room/private.pdf']));
    expect(fake.operations.map(operation => operation.table).at(-1)).toBe('deal_rooms');
    expect(fake.operations.map(operation => operation.table)).toEqual(expect.arrayContaining([
      'deal_analyses',
      'transaction_record_conflicts',
      'deal_room_tasks',
      'party_submissions',
      'deal_notifications',
      'deal_events',
      'transaction_record_fields',
      'deal_room_invites',
      'deal_room_participants',
      'deal_rooms',
    ]));
  });

  test('fails before database cleanup when storage removal fails and remains retryable', async () => {
    const fake = createFakeClient({ failRemove: true });

    await expect(deleteDealRoomData('room-1', fake.client)).rejects.toThrow(/Storage removing objects failed/);
    expect(fake.operations).toHaveLength(0);
    expect(fake.storageObjects.get('deal-documents')).toEqual(
      new Set(['room-1/source.pdf', 'room-1/nested/preparation.pdf', 'archive/room-preparation.pdf', 'other-room/private.pdf']),
    );
  });
});