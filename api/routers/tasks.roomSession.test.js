'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../db', () => {
  const crypto = require('node:crypto');
  const ownerToken = 'task-owner-session';
  const participantToken = 'task-participant-session';
  const hash = token => crypto.createHash('sha256').update(token).digest('hex');
  let task = { id: 'task-1', property_id: 'room-1' };
  const sessions = {
    [hash(ownerToken)]: { invite_id: 'owner-invite', expires_at: '2999-01-01T00:00:00.000Z', revoked_at: null },
    [hash(participantToken)]: { invite_id: 'participant-invite', expires_at: '2999-01-01T00:00:00.000Z', revoked_at: null },
  };
  const invites = {
    'owner-invite': { property_id: 'room-1', role_key: '__room_owner__', status: 'accepted', expires_at: '2999-01-01T00:00:00.000Z', revoked_at: null },
    'participant-invite': { property_id: 'room-1', role_key: 'seller', status: 'accepted', expires_at: '2999-01-01T00:00:00.000Z', revoked_at: null },
  };

  return {
    supabase: {
      __setTask(value) { task = value; },
      from(table) {
        const filters = {};
        const chain = {
          select: () => chain,
          eq: (key, value) => { filters[key] = value; return chain; },
          gt: () => chain,
          is: () => chain,
          maybeSingle: async () => {
            if (table === 'deal_room_tasks') {
              return {
                data: task && task.id === filters.id && task.property_id === filters.property_id
                  ? { property_id: task.property_id }
                  : null,
                error: null,
              };
            }
            if (table === 'deal_room_access_sessions') {
              return { data: sessions[filters.session_token_hash] || null, error: null };
            }
            if (table === 'deal_room_invites') {
              return { data: invites[filters.id] || null, error: null };
            }
            return { data: null, error: null };
          },
        };
        return chain;
      },
    },
  };
});

jest.mock('../lib/taskEngine', () => ({
  listTasksForRoom: jest.fn().mockResolvedValue([]),
  evaluateDealRoomForTasks: jest.fn().mockResolvedValue([]),
  approveTask: jest.fn(),
  dismissTask: jest.fn(),
}));

const { supabase } = require('../db');
const taskEngine = require('../lib/taskEngine');
const tasksRouter = require('./tasks');
const app = express();
app.use(express.json());
app.use('/api/public', tasksRouter);

const ownerCookie = 'kontra_owner_session=task-owner-session';
const participantToken = 'task-participant-session';

describe('room-scoped owner task decisions', () => {
  beforeEach(() => {
    supabase.__setTask({ id: 'task-1', property_id: 'room-1' });
    taskEngine.listTasksForRoom.mockResolvedValue([]);
    taskEngine.evaluateDealRoomForTasks.mockResolvedValue([]);
    taskEngine.approveTask.mockResolvedValue({ ok: true, task: { id: 'task-1' } });
    taskEngine.dismissTask.mockResolvedValue({ id: 'task-1' });
  });

  afterEach(() => jest.clearAllMocks());

  test('lists room tasks for the authenticated owner', async () => {
    const roomTasks = [{ id: 'task-1', property_id: 'room-1', title: 'Review package' }];
    taskEngine.listTasksForRoom.mockResolvedValue(roomTasks);

    const response = await request(app)
      .get('/api/public/deal-room/room-1/tasks')
      .set('Cookie', ownerCookie);

    expect(response.status).toBe(200);
    expect(response.body.tasks).toEqual(roomTasks);
    expect(taskEngine.listTasksForRoom).toHaveBeenCalledWith('room-1');
  });

  test('limits participant task listing to the participant role', async () => {
    taskEngine.listTasksForRoom.mockResolvedValue([
      { id: 'seller-task', owner_role: 'seller' },
      { id: 'buyer-task', owner_role: 'buyer' },
    ]);

    const response = await request(app)
      .get('/api/public/deal-room/room-1/tasks')
      .set('x-kontra-session', participantToken);

    expect(response.status).toBe(200);
    expect(response.body.tasks).toEqual([{ id: 'seller-task', owner_role: 'seller' }]);
  });

  test('rejects task listing without a verified room session', async () => {
    const response = await request(app).get('/api/public/deal-room/room-1/tasks');

    expect(response.status).toBe(403);
    expect(taskEngine.listTasksForRoom).not.toHaveBeenCalled();
  });

  test('refreshes tasks only for the authenticated room owner', async () => {
    taskEngine.evaluateDealRoomForTasks.mockResolvedValue([{ id: 'created-task' }]);
    taskEngine.listTasksForRoom.mockResolvedValue([{ id: 'task-1', property_id: 'room-1' }]);

    const response = await request(app)
      .post('/api/public/deal-room/room-1/tasks/refresh')
      .set('Cookie', ownerCookie)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.createdCount).toBe(1);
    expect(taskEngine.evaluateDealRoomForTasks).toHaveBeenCalledWith(
      'room-1',
      expect.objectContaining({ correlationId: expect.any(String) }),
    );
    expect(taskEngine.listTasksForRoom).toHaveBeenCalledWith('room-1');
  });

  test('rejects participant task refresh', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/room-1/tasks/refresh')
      .set('x-kontra-session', participantToken)
      .send({});

    expect(response.status).toBe(403);
    expect(taskEngine.evaluateDealRoomForTasks).not.toHaveBeenCalled();
  });

  test.each(['list', 'refresh'])('rejects an owner session from another room for task %s', async action => {
    const builder = action === 'list'
      ? request(app).get('/api/public/deal-room/room-2/tasks')
      : request(app).post('/api/public/deal-room/room-2/tasks/refresh').send({});
    const response = await builder.set('Cookie', ownerCookie);

    expect(response.status).toBe(403);
    expect(taskEngine.listTasksForRoom).not.toHaveBeenCalled();
    expect(taskEngine.evaluateDealRoomForTasks).not.toHaveBeenCalled();
  });

  test('allows a valid owner session to approve a task in its room', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/room-1/tasks/task-1/approve')
      .set('Cookie', ownerCookie);

    expect(response.status).toBe(200);
    expect(taskEngine.approveTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ propertyId: 'room-1', mode: 'owner' }),
      'approve',
    );
  });

  test('allows a valid owner session to dismiss a task in its room', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/room-1/tasks/task-1/dismiss')
      .set('Cookie', ownerCookie);

    expect(response.status).toBe(200);
    expect(taskEngine.dismissTask).toHaveBeenCalledWith('task-1');
  });

  test.each([
    ['missing session', builder => builder],
    ['raw owner-token header and body', builder => builder
      .set('x-owner-write-token', 'task-owner-session')
      .send({ owner_write_token: 'task-owner-session' })],
    ['participant session', builder => builder.set('x-kontra-session', participantToken)],
  ])('rejects %s for an owner-only task action', async (_label, configure) => {
    let pending = request(app).post('/api/public/deal-room/room-1/tasks/task-1/approve');
    pending = configure(pending);
    const response = await pending;

    expect(response.status).toBe(403);
    expect(taskEngine.approveTask).not.toHaveBeenCalled();
  });

  test.each([
    ['missing session', builder => builder],
    ['raw owner-token header and body', builder => builder
      .set('x-owner-write-token', 'task-owner-session')
      .send({ owner_write_token: 'task-owner-session' })],
    ['participant session', builder => builder.set('x-kontra-session', participantToken)],
  ])('rejects %s for an owner-only task dismissal', async (_label, configure) => {
    let pending = request(app).post('/api/public/deal-room/room-1/tasks/task-1/dismiss');
    pending = configure(pending);
    const response = await pending;

    expect(response.status).toBe(403);
    expect(taskEngine.dismissTask).not.toHaveBeenCalled();
  });

  test('rejects cross-room task IDs before owner authorization or action', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/room-2/tasks/task-1/approve')
      .set('Cookie', ownerCookie);

    expect(response.status).toBe(404);
    expect(taskEngine.approveTask).not.toHaveBeenCalled();
  });

  test('rejects cross-room task dismissal before owner authorization or action', async () => {
    const response = await request(app)
      .post('/api/public/deal-room/room-2/tasks/task-1/dismiss')
      .set('Cookie', ownerCookie);

    expect(response.status).toBe(404);
    expect(taskEngine.dismissTask).not.toHaveBeenCalled();
  });

  test('retires the old non-room-scoped action path', async () => {
    const response = await request(app)
      .post('/api/public/tasks/task-1/approve')
      .set('Cookie', ownerCookie);

    expect(response.status).toBe(410);
    expect(response.body.error).toBe('ROOM_SCOPED_TASK_ACTION_REQUIRED');
    expect(taskEngine.approveTask).not.toHaveBeenCalled();
  });
});
