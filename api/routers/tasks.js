// routers/tasks.js — Task Engine + AI Ownership Layer API (Observe Mode)
//
// Mounted at /api/public. Owner task decisions use room-scoped paths so the
// browser sends the existing owner cookie, and the task is checked against
// that room before authorization.
const express = require('express');
const crypto = require('crypto');
const { supabase } = require('../db');
const { resolveRoomSessionAccess } = require('../lib/roomSessionAccess');
const router = express.Router();
const {
  listTasksForRoom,
  evaluateDealRoomForTasks,
  approveTask,
  dismissTask,
} = require('../lib/taskEngine');

async function getTaskAccess(req, propertyId) {
  return resolveRoomSessionAccess(req, propertyId, supabase);
}

function deny(res) {
  return res.status(403).json({ error: 'Access denied', message: 'A verified deal-room invitation or owner session is required' });
}

async function loadTaskInRoom(taskId, propertyId) {
  const { data, error } = await supabase
    .from('deal_room_tasks')
    .select('property_id')
    .eq('id', taskId)
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) throw error;
  return data;
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
    const access = await getTaskAccess(req, propertyId);
    if (access.mode !== 'owner') return deny(res);
    const created = await evaluateDealRoomForTasks(propertyId, {
      correlationId: req.headers['x-correlation-id'] || crypto.randomUUID(),
    });
    const tasks = await listTasksForRoom(propertyId);
    res.json({ tasks, createdCount: created.length });
  } catch (err) {
    console.error('[tasks] refresh failed:', err.message);
    res.status(500).json({ error: 'Failed to refresh tasks' });
  }
});

router.post('/deal-room/:propertyId/tasks/:taskId/approve', async (req, res) => {
  try {
    const { propertyId, taskId } = req.params;
    const task = await loadTaskInRoom(taskId, propertyId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const access = await getTaskAccess(req, propertyId);
    if (access.mode !== 'owner') return deny(res);
    const decision = ['approve', 'reject', 'send_back'].includes(req.body?.decision)
      ? req.body.decision
      : 'approve';
    const result = await approveTask(taskId, {
      ...access,
      propertyId,
      reason: req.body?.reason || null,
      idempotencyKey: req.headers['x-idempotency-key'] || req.body?.idempotencyKey,
    }, decision);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true, task: result.task || null, decision });
  } catch (err) {
    console.error('[tasks] approve failed:', err.message);
    res.status(500).json({ error: 'Failed to approve task' });
  }
});

router.post('/deal-room/:propertyId/tasks/:taskId/dismiss', async (req, res) => {
  try {
    const { propertyId, taskId } = req.params;
    const taskRecord = await loadTaskInRoom(taskId, propertyId);
    if (!taskRecord) return res.status(404).json({ error: 'Task not found' });
    const access = await getTaskAccess(req, propertyId);
    if (access.mode !== 'owner') return deny(res);
    const task = await dismissTask(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[tasks] dismiss failed:', err.message);
    res.status(500).json({ error: 'Failed to dismiss task' });
  }
});

const rejectLegacyTaskAction = (_req, res) => res.status(410).json({
  error: 'ROOM_SCOPED_TASK_ACTION_REQUIRED',
  message: 'Use the room-scoped task action endpoint.',
});
router.post('/tasks/:taskId/approve', rejectLegacyTaskAction);
router.post('/tasks/:taskId/dismiss', rejectLegacyTaskAction);

module.exports = router;
