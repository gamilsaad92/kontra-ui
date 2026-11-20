const express = require('express');
const { supabase } = require('../db');
const { logUserEvent, suggestNextFeature } = require('../personalization');

const router = express.Router();

router.get('/mobile/overview', async (req, res) => {
  const userId = req.authUserId;
  const orgId = req.orgId;
  if (
    !req.authContext?.verified ||
    !userId ||
    !orgId ||
    req.membership?.status !== 'active' ||
    req.membership?.deleted_at ||
    String(req.membership?.org_id) !== String(orgId)
  ) {
    return res.status(403).json({ code: 'ORG_MEMBERSHIP_REQUIRED' });
  }

  const scoped = (table) => ({
    select(...args) {
      return supabase.from(table).select(...args).eq('organization_id', orgId);
    },
  });

  const now = new Date();
  const lastThirty = new Date(now);
  lastThirty.setDate(now.getDate() - 30);

  try {
    const [
      totalApplicationsResult,
      approvedApplicationsResult,
      creditScoresResult,
      recentApplicationsResult,
      totalTasksResult,
      pendingTasksResult,
      recentTasksResult,
      alertsResult
    ] = await Promise.all([
      scoped('loan_applications').select('id', { count: 'exact', head: true }),
      scoped('loan_applications').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      scoped('loan_applications')
        .select('credit_score, amount, status')
        .gte('submitted_at', lastThirty.toISOString()),
      scoped('loan_applications')
        .select('id, name, amount, status, decision, submitted_at')
        .order('submitted_at', { ascending: false })
        .limit(10),
      scoped('underwriting_tasks').select('id', { count: 'exact', head: true }),
      scoped('underwriting_tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      scoped('underwriting_tasks')
        .select('id, title, priority, status, due_date, owner, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10),
      scoped('delinquency_alerts')
        .select('id, loan_id, severity, message, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    const errors = [
      totalApplicationsResult.error,
      approvedApplicationsResult.error,
      creditScoresResult.error,
      recentApplicationsResult.error,
      totalTasksResult.error,
      pendingTasksResult.error,
      recentTasksResult.error,
      alertsResult.error
    ].filter(Boolean);

    if (errors.length) {
      throw errors[0];
    }

    const totalApplications = totalApplicationsResult.count || 0;
    const approvedApplications = approvedApplicationsResult.count || 0;
    const totalTasks = totalTasksResult.count || 0;
    const pendingTasks = pendingTasksResult.count || 0;

    const creditScores = (creditScoresResult.data || [])
      .map(entry => Number(entry.credit_score))
      .filter(score => !Number.isNaN(score) && score > 0);
    const amounts = (creditScoresResult.data || [])
      .filter(entry => entry.status === 'approved')
      .map(entry => Number(entry.amount || 0));

    const averageCreditScore = creditScores.length
      ? creditScores.reduce((sum, score) => sum + score, 0) / creditScores.length
      : 0;
    const portfolioValue = amounts.reduce((sum, amount) => sum + amount, 0);

    const recentApplications = (recentApplicationsResult.data || []).map(app => ({
      ...app,
      amount: Number(app.amount || 0)
    }));

    const recentTasks = (recentTasksResult.data || []).map(task => ({
      ...task,
      due_date: task.due_date,
      owner: task.owner || null
    }));

    const alerts = alertsResult.data || [];

    const activity = buildActivityFeed(recentApplications, recentTasks, alerts);

    logUserEvent(userId, 'mobile_overview_opened');
    if (orgId) logUserEvent(`${orgId}:${userId}`, 'mobile_overview_opened');

    const suggestion = await suggestNextFeature(userId);

    res.json({
      summary: {
        totalApplications,
        approvedApplications,
        totalTasks,
        pendingTasks,
        averageCreditScore,
        portfolioValue,
        lastUpdated: now.toISOString()
      },
      applications: recentApplications,
      tasks: recentTasks,
      alerts,
      activity,
      suggestion
    });
  } catch (err) {
    console.error('Failed to build mobile overview', err);
    res.status(503).json({ error: 'Mobile overview is unavailable' });
  }
});

function buildActivityFeed(applications, tasks, alerts) {
  const applicationEvents = applications.slice(0, 5).map(app => ({
    id: `app-${app.id}`,
    type: 'application',
    title: `${app.name} submitted`,
    detail: `Status: ${app.status}`,
    timestamp: app.submitted_at
  }));

  const taskEvents = tasks.slice(0, 5).map(task => ({
    id: `task-${task.id}`,
    type: 'task',
    title: task.title,
    detail: `Owner: ${task.owner || 'Unassigned'}`,
    timestamp: task.updated_at
  }));

  const alertEvents = alerts.slice(0, 5).map(alert => ({
    id: `alert-${alert.id}`,
    type: 'alert',
    title: `Loan #${alert.loan_id || 'N/A'}`,
    detail: alert.message,
    timestamp: alert.created_at
  }));

  return [...applicationEvents, ...taskEvents, ...alertEvents]
    .filter(event => !!event.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

module.exports = router;
