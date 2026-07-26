// routers/tasks.js — Task Engine + AI Ownership Layer API (Observe Mode)
//
// Mounted at /api/public/deal-room/:propertyId/tasks* alongside the other
// public deal-room routes (same property-scoped, no-org-auth model — see
// index.js for the rest of the /api/public/deal-room/* surface). Also
// exposes a global /api/tasks/:id/approve|dismiss since a task's id is
// already an unguessable UUID and the approve/dismiss actions don't need
// the propertyId in the path.
const express = require('express');
const router = express.Router();
const {
  listTasksForRoom,
  evaluateDealRoomForTasks,
  approveTask,
  dismissTask,
} = require('../lib/taskEngine');

router.get('/deal-room/:propertyId/tasks', async (req, res) => {
  try {
    const tasks = await listTasksForRoom(req.params.propertyId);
    res.json({ tasks });
  } catch (err) {
    console.error('[tasks] list failed:', err.message);
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});

router.post('/deal-room/:propertyId/tasks/refresh', async (req, res) => {
  try {
    const created = await evaluateDealRoomForTasks(req.params.propertyId);
    const tasks = await listTasksForRoom(req.params.propertyId);
    res.json({ tasks, createdCount: created.length });
  } catch (err) {
    console.error('[tasks] refresh failed:', err.message);
    res.status(500).json({ error: 'Failed to refresh tasks' });
  }
});

router.post('/tasks/:taskId/approve', async (req, res) => {
  try {
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
    const task = await dismissTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[tasks] dismiss failed:', err.message);
    res.status(500).json({ error: 'Failed to dismiss task' });
  }
});

module.exports = router;
