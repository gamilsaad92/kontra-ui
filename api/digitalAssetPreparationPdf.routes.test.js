'use strict';

const request = require('supertest');
const app = require('./index');

describe('Digital Asset Preparation PDF routes', () => {
  test('does not expose artifact history to an anonymous room visitor', async () => {
    const response = await request(app)
      .get('/api/public/deal-room/unknown-room/digital-asset-packages/unknown-package/artifacts');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Access denied');
  });

  test('does not allow an anonymous visitor to generate a preparation PDF', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/unknown-room/digital-asset-packages/unknown-package/revisions/unknown-revision/artifacts')
      .send({
        revision: 1,
        sourceSnapshotId: 'snapshot-id',
        sourceSnapshotVersion: 8,
        sourceSnapshotHash: 'snapshot-hash',
        packageHash: 'package-hash',
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Access denied');
  });
});