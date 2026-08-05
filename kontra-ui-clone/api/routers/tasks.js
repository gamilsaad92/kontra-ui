// routers/tasks.js — Task Engine + AI Ownership Layer API (Observe Mode)
//
// Mounted at /api/public/deal-room/:propertyId/tasks* alongside the other
// public deal-room routes (same property-scoped, no-org-auth model — see
// index.js for the rest of the /api/public/deal-room/* surface). Also
// exposes a global /api/tasks/:id/approve|dismiss since a task's id is
// already an unguessable UUID and the approve/dismiss actions don't need
// the propertyId in the path.
const express = require('express');
const crypto = require('crypto');
const { supabase } = require('../db');
const router = express.Router();
const {
  listTasksForRoom,
  evaluateDealRoomForTasks,
  approveTask,
  dismissTask,
} = require('../lib/taskEngine');

async function getTaskAccess(req, propertyId, ownerTokenOverride = '') {
  const sessionToken = String(req.headers['x-kontra-session'] || '').trim();
  if (sessionToken) {
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const { data: session } = await supabase
      .from('deal_room_access_sessions')
      .select('invite_id')
      .eq('session_token_hash', tokenHash)
      .gt('expires_at', new Date().toISOString())
      .is('revoked_at', null)
      .maybeSingle();
    if (session?.invite_id) {
      const { data: invite } = await supabase
        .from('deal_room_invites')
        .select('property_id, role_key, status')
        .eq('id', session.invite_id)
        .maybeSingle();
      if (invite?.property_id === propertyId && !['revoked', 'expired'].includes(invite.status)) {
        return { mode: 'participant', role: invite.role_key };
      }
    }
  }

  const ownerToken = String(
    req.headers['x-owner-write-token'] || ownerTokenOverride || '',
  ).trim();
  if (ownerToken) {
    const { data: room } = await supabase
      .from('deal_rooms')
      .select('owner_write_token')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (room?.owner_write_token && room.owner_write_token === ownerToken) {
      return { mode: 'owner', role: 'owner' };
    }
  }
  return { mode: 'anonymous', role: 'guest' };
}

function deny(res) {
  return res.status(403).json({ error: 'Access denied', message: 'A verified deal-room invitation or owner access token is required' });
}

router.get('/deal-room/:propertyId/tasks', async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    const access = await getTaskAccess(req, propertyId);
    if (access.mode === 'anonymous') return deny(res);
    const allTasks = await listTasksForRoom(propertyId);
    const tasks = access.mode === 'participant'
      ? allTasks.filter(task => task.owner_role === access.role)
      : allTasks;
    res.json({ tasks });
  } catch (err) {
    console.error('[tasks] list failed:', err.message);
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});

router.post('/deal-room/:propertyId/tasks/refresh', async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    const access = await getTaskAccess(req, propertyId, req.body?.ownerWriteToken);
    if (access.mode !== 'owner') return deny(res);
    const created = await evaluateDealRoomForTasks(propertyId);
    const tasks = await listTasksForRoom(propertyId);
    res.json({ tasks, createdCount: created.length });
  } catch (err) {
    console.error('[tasks] refresh failed:', err.message);
    res.status(500).json({ error: 'Failed to refresh tasks' });
  }
});

router.post('/tasks/:taskId/approve', async (req, res) => {
  try {
    const { data: task } = await supabase
      .from('deal_room_tasks')
      .select('property_id')
      .eq('id', req.params.taskId)
      .maybeSingle();
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const access = await getTaskAccess(req, task.property_id, req.body?.ownerWriteToken);
    if (access.mode !== 'owner') return deny(res);
    const result = await approveTask(req.params.taskId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) {
    console.error('[tasks] approve failed:', err.message);
    res.status(500).json({ error: 'Failed to approve task' });
  }
});

router.post('/tasks/:taskId/dismiss', async (req, res) => {
  try {
    const { data: taskRecord } = await supabase
      .from('deal_room_tasks')
      .select('property_id')
      .eq('id', req.params.taskId)
      .maybeSingle();
    if (!taskRecord) return res.status(404).json({ error: 'Task not found' });
    const access = await getTaskAccess(req, taskRecord.property_id, req.body?.ownerWriteToken);
    if (access.mode !== 'owner') return deny(res);
    const task = await dismissTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[tasks] dismiss failed:', err.message);
    res.status(500).json({ error: 'Failed to dismiss task' });
  }
});

module.exports = router;
