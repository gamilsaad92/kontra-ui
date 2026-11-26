const express = require('express');
const request = require('supertest');

const { supabase } = require('../db');
const { resolveRoomSessionAccess } = require('../lib/roomSessionAccess');
const router = require('./verifiedAssetPackage');

jest.mock('../db', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../lib/roomSessionAccess', () => ({
  resolveRoomSessionAccess: jest.fn(),
}));
jest.mock('../lib/openaiClient', () => ({
  createInstitutionalOpenAIClient: () => ({}),
}));

function selectResult(data, error = null) {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn(async () => ({ data, error })),
  };
  return builder;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  supabase.from.mockImplementation((table) => {
    if (table === 'deal_rooms') {
      return selectResult({ property_name: 'Synthetic Room', customer_email: '', first_name: 'Owner' });
    }
    if (table === 'verified_asset_packages') {
      return selectResult({ package: { handoff: { schema_version: '1.0.0' } } });
    }
    if (table === 'deal_events') {
      return { insert: jest.fn(async () => ({ error: null })) };
    }
    throw new Error(`Unexpected table ${table}`);
  });
});

test.each(['anonymous', 'participant'])('share creation rejects %s access before reading room data', async (mode) => {
  resolveRoomSessionAccess.mockResolvedValue({ mode });

  const response = await request(buildApp())
    .post('/api/public/deal-room/synthetic-room/verified-asset-package/share')
    .send({});

  expect(response.status).toBe(403);
  expect(supabase.from).not.toHaveBeenCalled();
});

test('owner can create a read-only share only for a persisted package', async () => {
  resolveRoomSessionAccess.mockResolvedValue({ mode: 'owner' });

  const response = await request(buildApp())
    .post('/api/public/deal-room/synthetic-room/verified-asset-package/share')
    .send({});

  expect(response.status).toBe(200);
  expect(response.body.token).toEqual(expect.any(String));
  expect(response.body.expiresAt).toEqual(expect.any(String));
  expect(resolveRoomSessionAccess).toHaveBeenCalledWith(
    expect.objectContaining({ params: { propertyId: 'synthetic-room' } }),
    'synthetic-room',
    supabase,
  );
});

test('owner cannot create a share link when no package is stored', async () => {
  resolveRoomSessionAccess.mockResolvedValue({ mode: 'owner' });
  supabase.from.mockImplementation((table) => {
    if (table === 'deal_rooms') {
      return selectResult({ property_name: 'Synthetic Room', first_name: 'Owner' });
    }
    if (table === 'verified_asset_packages') return selectResult(null);
    throw new Error(`Unexpected table ${table}`);
  });

  const response = await request(buildApp())
    .post('/api/public/deal-room/synthetic-room/verified-asset-package/share')
    .send({});

  expect(response.status).toBe(409);
  expect(response.body.error).toBe('LEGACY_PACKAGE_NOT_FOUND');
  expect(response.body.token).toBeUndefined();
  expect(supabase.from).not.toHaveBeenCalledWith('deal_events');
});
