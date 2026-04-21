const express = require('express');
const { supabase } = require('../db');
const { logUserEvent, suggestNextFeature } = require('../personalization');

const router = express.Router();

router.get('/mobile/overview', async (req, res) => {
  const userId = req.header('x-user-id') || 'mobile_operator';
 const orgId = req.header('x-organization-id') || req.header('x-org-id') || null;

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
      supabase.from('loan_applications').select('id', { count: 'exact', head: true }),
      supabase.from('loan_applications').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase
        .from('loan_applications')
        .select('credit_score, amount, status')
        .gte('submitted_at', lastThirty.toISOString()),
      supabase
        .from('loan_applications')
        .select('id, name, amount, status, decision, submitted_at')
        .order('submitted_at', { ascending: false })
        .limit(10),
      supabase.from('underwriting_tasks').select('id', { count: 'exact', head: true }),
      supabase.from('underwriting_tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase
        .from('underwriting_tasks')
        .select('id, title, priority, status, due_date, owner, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('delinquency_alerts')
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
    res.status(200).json({ ...buildFallbackOverview(now), fallback: true });
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

function buildFallbackOverview(now = new Date()) {
  const recent = new Date(now);
  recent.setDate(now.getDate() - 1);

  const applications = [
    {
      id: 1,
      name: 'Sample Borrower',
      amount: 250000,
      status: 'under_review',
      decision: 'review',
      submitted_at: recent.toISOString()
    }
  ];

  const tasks = [
    {
      id: 1,
      title: 'Review uploaded bank statements',
      priority: 'urgent',
      status: 'pending',
      owner: 'Mobile Ops',
      due_date: now.toISOString(),
      updated_at: now.toISOString()
    }
  ];

  const alerts = [
    {
      id: 1,
      loan_id: 101,
      severity: 'medium',
      message: 'Payment reminder generated for borrower.',
      created_at: now.toISOString()
    }
  ];

  return {
    summary: {
      totalApplications: 1,
      approvedApplications: 0,
      totalTasks: 1,
      pendingTasks: 1,
      averageCreditScore: 680,
      portfolioValue: 250000,
      lastUpdated: now.toISOString()
    },
    applications,
    tasks,
    alerts,
    activity: buildActivityFeed(applications, tasks, alerts),
    suggestion: 'Connect to the Kontra API to see live data from your portfolio.'
  };
}

module.exports = router;
