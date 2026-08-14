// taskEngine.js — the "Task Engine + AI Ownership Layer" (Observe Mode)
//
// Product principle (see .agents/memory/kontra-index-split.md sibling context):
// every action in a workspace has an explicit owner — a human role (attorney,
// lender, owner, ...) or "ai" — and lives as a row in `tasks` with a status,
// evidence for *why* it exists, and (for AI-owned tasks) an optional
// draft_action the AI would take if approved. In Observe Mode, AI may only
// create/recommend tasks and draft actions — it may never execute a
// draft_action (e.g. send an email) without a human calling approveTask().
const crypto = require('crypto');
const { supabase } = require('../db');
const {
  DEFAULT_PACK_ID,
  getPackRoleConfig,
  getPackRoleLabel,
  getRoomPackId,
  sendResendEmail,
  logEvent,
} = require('./dealRoomHelpers');
const { emit } = require('./eventBus');

// ── Schema bootstrap (Replit Postgres local dev) ────────────────────────────
// Mirrors the pattern in routers/workflowPacks.js: lazily create the table
// via a raw pg Pool when DATABASE_URL is present. In production (real
// Supabase), this table is created via a migration instead — see
// kontra-ui-clone/api/migrations/007_tasks.sql.
let _pg = null;
function getPg() {
  if (!_pg && process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      _pg = new Pool({ connectionString: process.env.DATABASE_URL });
      _pg.query(`
        CREATE TABLE IF NOT EXISTS deal_room_tasks (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          property_id   TEXT NOT NULL,
          task_type     TEXT NOT NULL,
          title         TEXT NOT NULL,
          description   TEXT,
          owner_type    TEXT NOT NULL DEFAULT 'human',
          owner_role    TEXT,
          status        TEXT NOT NULL DEFAULT 'pending',
          evidence      JSONB DEFAULT '[]'::jsonb,
          draft_action  JSONB,
          source_type   TEXT,
          source_id     TEXT,
          due_at        TIMESTAMPTZ,
          severity      TEXT,
          blocking      BOOLEAN,
          category      TEXT,
          source_document_id TEXT,
          source_page   INTEGER,
          source_excerpt TEXT,
          source_agent  TEXT,
          source_run_id TEXT,
          correlation_id UUID,
          required_approver_role TEXT,
          rejection_reason TEXT,
          send_back_reason TEXT,
          decision      TEXT,
          decision_actor_id TEXT,
          decision_actor_role TEXT,
          decision_reason TEXT,
          decision_at   TIMESTAMPTZ,
          idempotency_key TEXT,
          execution_status TEXT,
          execution_result JSONB,
          executed_at   TIMESTAMPTZ,
          resolved_at   TIMESTAMPTZ,
          created_at    TIMESTAMPTZ DEFAULT NOW(),
          updated_at    TIMESTAMPTZ DEFAULT NOW()
        )
      `).then(() => _pg.query(`
        ALTER TABLE deal_room_tasks
          ADD COLUMN IF NOT EXISTS severity TEXT,
          ADD COLUMN IF NOT EXISTS blocking BOOLEAN,
          ADD COLUMN IF NOT EXISTS category TEXT,
          ADD COLUMN IF NOT EXISTS source_document_id TEXT,
          ADD COLUMN IF NOT EXISTS source_page INTEGER,
          ADD COLUMN IF NOT EXISTS source_excerpt TEXT,
          ADD COLUMN IF NOT EXISTS source_agent TEXT,
          ADD COLUMN IF NOT EXISTS source_run_id TEXT,
          ADD COLUMN IF NOT EXISTS correlation_id UUID,
          ADD COLUMN IF NOT EXISTS required_approver_role TEXT,
          ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
          ADD COLUMN IF NOT EXISTS send_back_reason TEXT,
          ADD COLUMN IF NOT EXISTS decision TEXT,
          ADD COLUMN IF NOT EXISTS decision_actor_id TEXT,
          ADD COLUMN IF NOT EXISTS decision_actor_role TEXT,
          ADD COLUMN IF NOT EXISTS decision_reason TEXT,
          ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
          ADD COLUMN IF NOT EXISTS execution_status TEXT,
          ADD COLUMN IF NOT EXISTS execution_result JSONB,
          ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
        CREATE INDEX IF NOT EXISTS idx_deal_room_tasks_property ON deal_room_tasks(property_id, status)
      `)).then(() => console.log('[tasks] table ready'))
        .catch(e => console.warn('[tasks] table init:', e.message));
    } catch (e) {
      console.warn('[tasks] pg unavailable:', e.message);
    }
  }
  return _pg;
}
getPg();

// ── CRUD ─────────────────────────────────────────────────────────────────
async function listTasksForRoom(propertyId) {
  const { data, error } = await supabase
    .from('deal_room_tasks')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });
  if (error) { console.warn('[taskEngine] listTasksForRoom:', error.message); return []; }
  return data || [];
}

async function createTask(propertyId, fields) {
  const correlationId = fields.correlationId || null;
  const row = {
    property_id: propertyId,
    task_type: fields.taskType,
    title: fields.title,
    description: fields.description || null,
    owner_type: fields.ownerType || 'human',
    owner_role: fields.ownerRole || null,
    status: fields.status || 'pending',
    evidence: JSON.stringify(fields.evidence || []),
    draft_action: fields.draftAction ? JSON.stringify(fields.draftAction) : null,
    source_type: fields.sourceType || null,
    source_id: fields.sourceId || null,
    due_at: fields.dueAt || null,
    severity: fields.severity || null,
    blocking: fields.blocking ?? null,
    category: fields.category || null,
    source_document_id: fields.sourceDocumentId || null,
    source_page: fields.sourcePage || null,
    source_excerpt: fields.sourceExcerpt || null,
    source_agent: fields.sourceAgent || null,
    source_run_id: fields.sourceRunId || null,
    correlation_id: correlationId,
    required_approver_role: fields.requiredApproverRole || null,
    idempotency_key: fields.idempotencyKey || (
      fields.sourceId
        ? `${propertyId}:${fields.taskType}:${fields.sourceType || ''}:${fields.sourceId}`
        : null
    ),
  };
  const { data, error } = await supabase.from('deal_room_tasks').insert(row).select('*').single();
  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) return null;
    const legacyRow = {
      property_id: row.property_id, task_type: row.task_type, title: row.title,
      description: row.description, owner_type: row.owner_type, owner_role: row.owner_role,
      status: row.status, evidence: row.evidence, draft_action: row.draft_action,
      source_type: row.source_type, source_id: row.source_id, due_at: row.due_at,
    };
    const legacy = await supabase.from('deal_room_tasks').insert(legacyRow).select('*').single();
    if (legacy.error) { console.warn('[taskEngine] createTask:', legacy.error.message); return null; }
    return legacy.data;
  }
  emit('task.created', {
    propertyId, taskId: data.id, taskType: data.task_type,
    sourceType: data.source_type, sourceId: data.source_id, correlationId,
  }, { correlationId, source: fields.sourceAgent || 'task-engine' });
  return data;
}

async function updateTaskStatus(taskId, status) {
  const { data, error } = await supabase
    .from('deal_room_tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select('*')
    .single();
  if (error) { console.warn('[taskEngine] updateTaskStatus:', error.message); return null; }
  return data;
}

// ── Approve: the only place a draft_action is ever executed ────────────────
// This is the human-in-the-loop gate. Observe Mode never calls this
// automatically — it only ever runs in response to an explicit human click
// on "Approve" in the UI.
async function approveTask(taskId, context = {}, decision = 'approve') {
  const { data: task, error } = await supabase.from('deal_room_tasks').select('*').eq('id', taskId).maybeSingle();
  if (error || !task) return { ok: false, error: 'Task not found' };
  if (context.propertyId && task.property_id !== context.propertyId) {
    return { ok: false, error: 'Task is outside this deal room' };
  }
  if (context.mode && context.mode !== 'owner') return { ok: false, error: 'Owner approval required' };
  if (task.required_approver_role && task.required_approver_role !== context.role) {
    return { ok: false, error: 'Your role cannot approve this task' };
  }
  if (['completed', 'dismissed'].includes(task.status) || task.execution_status === 'completed') {
    return { ok: false, error: 'Task is already resolved' };
  }
  if (!['approve', 'reject', 'send_back'].includes(decision)) {
    return { ok: false, error: 'Unsupported task decision' };
  }

  const now = new Date().toISOString();
  const actorId = context.actorId || context.email || 'owner';
  const actorRole = context.role || 'owner';
  const reason = context.reason || null;

  if (decision !== 'approve') {
    const { data: changed, error: decisionError } = await supabase
      .from('deal_room_tasks')
      .update({
        decision,
        decision_actor_id: actorId,
        decision_actor_role: actorRole,
        decision_reason: reason,
        decision_at: now,
        rejection_reason: decision === 'reject' ? reason : null,
        send_back_reason: decision === 'send_back' ? reason : null,
        status: decision === 'reject' ? 'dismissed' : 'pending',
        resolved_at: decision === 'reject' ? now : null,
        updated_at: now,
      })
      .eq('id', taskId)
      .eq('status', task.status)
      .select('*')
      .maybeSingle();
    if (decisionError || !changed) return { ok: false, error: 'Task was already decided' };
    emit('action.rejected', {
      propertyId: task.property_id, taskId, decision, reason,
      correlationId: task.correlation_id,
    }, {
      correlationId: task.correlation_id, actorId,
      actorType: context.actorType || 'owner', source: 'task-approval',
    });
    logEvent(task.property_id, decision === 'reject' ? 'action_rejected' : 'action_sent_back',
      actorRole, actorId, `${decision === 'reject' ? 'Rejected' : 'Sent back'}: ${task.title}`, {
        taskId, taskType: task.task_type, correlationId: task.correlation_id,
        actorId, actorType: context.actorType || 'owner', source: 'task-approval',
        outcome: { decision, reason },
      }).catch(() => {});
    return { ok: true, task: changed, decision };
  }

  const idempotencyKey = context.idempotencyKey || crypto.randomUUID();
  const { data: executing, error: claimError } = await supabase
    .from('deal_room_tasks')
    .update({
      status: 'in_progress',
      execution_status: 'executing',
      decision: 'approve',
      decision_actor_id: actorId,
      decision_actor_role: actorRole,
      decision_reason: reason,
      decision_at: now,
      idempotency_key: idempotencyKey,
      updated_at: now,
    })
    .eq('id', taskId)
    .eq('status', task.status)
    // PostgreSQL's `!=` does not match NULL. Untouched tasks have no
    // execution_status yet, so allow NULL as well as any non-running state.
    .or('execution_status.is.null,execution_status.neq.executing')
    .select('*')
    .maybeSingle();
  if (claimError || !executing) return { ok: false, error: 'Task was already approved or is no longer pending' };

  const action = typeof task.draft_action === 'string'
    ? (() => { try { return JSON.parse(task.draft_action); } catch { return null; } })()
    : task.draft_action;
  try {
    if (action?.type === 'email') {
      const RESEND_KEY = process.env.RESEND_API_KEY;
      if (!RESEND_KEY) throw new Error('Email delivery is not configured');
      await sendResendEmail(RESEND_KEY, {
        from: 'Kontra <notifications@kontraplatform.com>',
        to: action.to,
        subject: action.subject,
        html: action.html || `<p>${action.body || ''}</p>`,
      });
    }
    // Non-email draft actions (e.g. "advance_stage") are intentionally not
    // auto-executed yet — Observe Mode only ships the email-drafting path.
    const { data: completed, error: completionError } = await supabase
      .from('deal_room_tasks')
      .update({
        status: 'completed',
        execution_status: action ? 'completed' : 'not_applicable',
        execution_result: { ok: true, actionType: action?.type || null, idempotencyKey },
        executed_at: new Date().toISOString(),
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('status', 'in_progress')
      .select('*')
      .maybeSingle();
    if (completionError || !completed) return { ok: false, error: 'Task execution state could not be saved' };
    emit('action.executed', {
      propertyId: task.property_id, taskId, actionType: action?.type || null,
      correlationId: task.correlation_id, idempotencyKey,
    }, {
      correlationId: task.correlation_id, actorId,
      actorType: context.actorType || 'owner', source: 'task-approval',
    });
    logEvent(task.property_id, 'action_executed', actorRole, actorId,
      `Approved: ${task.title}`, {
        taskId, taskType: task.task_type, correlationId: task.correlation_id,
        actorId, actorType: context.actorType || 'owner', source: 'task-approval',
        outcome: { ok: true, actionType: action?.type || null, idempotencyKey },
      }).catch(() => {});
    return { ok: true, task: completed };
  } catch (e) {
    console.warn('[taskEngine] approveTask failed:', e.message);
    await supabase.from('deal_room_tasks').update({
      status: 'escalated',
      execution_status: 'failed',
      execution_result: { ok: false, error: e.message, idempotencyKey },
      updated_at: new Date().toISOString(),
    }).eq('id', taskId).eq('status', 'in_progress');
    emit('action.failed', {
      propertyId: task.property_id, taskId, error: e.message,
      correlationId: task.correlation_id, idempotencyKey,
    }, {
      correlationId: task.correlation_id, actorId,
      actorType: context.actorType || 'owner', source: 'task-approval',
    });
    logEvent(task.property_id, 'action_failed', actorRole, actorId,
      `Failed: ${task.title}`, {
        taskId, taskType: task.task_type, correlationId: task.correlation_id,
        actorId, actorType: context.actorType || 'owner', source: 'task-approval',
        outcome: { ok: false, error: e.message, idempotencyKey },
      }).catch(() => {});
    return { ok: false, error: e.message };
  }
}

async function dismissTask(taskId) {
  const task = await updateTaskStatus(taskId, 'dismissed');
  if (task) {
    logEvent(task.property_id, 'task_dismissed', 'owner', null,
      `Dismissed: ${task.title}`, { taskId, taskType: task.task_type }).catch(() => {});
  }
  return task;
}

// ── Evaluate a room: the "AI notices things" half of the engine ────────────
// Deliberately conservative and evidence-driven — every AI-owned task must
// carry concrete evidence strings, never a vague "something seems off". Only
// creates a task if one with the same task_type+source has never existed, so
// refreshing does not spam duplicates or resurrect completed work.
async function evaluateDealRoomForTasks(propertyId, options = {}) {
  const packId = await getRoomPackId(propertyId);
  const roleConfig = getPackRoleConfig(packId);

  const [existingRes, submissionsRes, analysesRes] = await Promise.all([
    supabase.from('deal_room_tasks').select('task_type, source_type, source_id, status').eq('property_id', propertyId),
    supabase.from('party_submissions').select('role, email, name, status, submitted_at').eq('property_id', propertyId),
    supabase.from('deal_analyses').select('id, section, filename, analysis, created_at').eq('property_id', propertyId),
  ]);

  const existing = existingRes.data || [];
  const submissions = submissionsRes.data || [];
  const analyses = analysesRes.data || [];

  const hasExistingTask = (taskType, sourceId) => existing.some(t =>
    t.task_type === taskType && t.source_id === sourceId);

  const created = [];

  // 1) Missing required party — required role never invited/submitted.
  const requiredRoles = (roleConfig.roles || []).filter(r => r.required && r.needsDocs);
  for (const role of requiredRoles) {
    const sub = submissions.find(s => s.role === role.key);
    if (sub) continue;
    const sourceId = `missing-role:${role.key}`;
    if (hasExistingTask('missing_participant', sourceId)) continue;
    const roleLabel = getPackRoleLabel(packId, role.key);
    const task = await createTask(propertyId, {
      taskType: 'missing_participant',
      title: `${roleLabel} has not been invited or submitted documents yet`,
      description: `The ${roleLabel} role is required for this deal type but has no submission on record.`,
      ownerType: 'ai',
      ownerRole: 'owner',
      evidence: [`No party_submissions record found for role "${role.key}" (${roleLabel}).`],
      draftAction: null,
      sourceType: 'party_role',
      sourceId,
      category: 'participant',
      blocking: true,
      severity: 'high',
      correlationId: options.correlationId,
    });
    if (task) created.push(task);
  }

  // 2) Stuck-pending submission — invited but hasn't submitted after being asked.
  for (const sub of submissions) {
    if (sub.status !== 'pending' && sub.status !== 'invited') continue;
    const sourceId = `pending-submission:${sub.role}`;
    if (hasExistingTask('pending_submission', sourceId)) continue;
    const roleLabel = getPackRoleLabel(packId, sub.role);
    const task = await createTask(propertyId, {
      taskType: 'pending_submission',
      title: `${roleLabel} invited but hasn't submitted yet`,
      description: `${sub.name || roleLabel} was invited but has not completed their submission.`,
      ownerType: 'ai',
      ownerRole: sub.role,
      evidence: [`party_submissions.status = "${sub.status}" for role "${sub.role}" (invited, not yet submitted).`],
      draftAction: sub.email ? {
        type: 'email',
        to: sub.email,
        subject: `Reminder: your documents for this deal room`,
        body: `Hi ${sub.name || roleLabel}, this is a reminder to complete your document submission for this deal room when you have a moment.`,
      } : null,
      sourceType: 'party_submission',
      sourceId,
      category: 'participant',
      blocking: false,
      severity: 'medium',
      correlationId: options.correlationId,
    });
    if (task) created.push(task);
  }

  // 3) Document analysis flags — insurance/expiration language surfaced by AI review.
  const EXPIRY_HINT = /expir|renew|lapsed?\b/i;
  const MISSING_HINT = /missing (appendix|schedule|exhibit|attachment)/i;
  for (const doc of analyses) {
    const summary = doc.analysis?.summary || '';
    if (!summary) continue;
    const sourceId = `analysis:${doc.id}`;
    if (hasExistingTask('document_flag', sourceId)) continue;
    let flagReason = null;
    if (EXPIRY_HINT.test(summary)) flagReason = 'expiration';
    else if (MISSING_HINT.test(summary)) flagReason = 'missing_reference';
    if (!flagReason) continue;
    const task = await createTask(propertyId, {
      taskType: 'document_flag',
      title: flagReason === 'expiration'
        ? `${doc.filename || doc.section} may be expiring or lapsed`
        : `${doc.filename || doc.section} references a missing attachment`,
      description: summary,
      ownerType: 'ai',
      ownerRole: 'owner',
      evidence: [`AI analysis of "${doc.filename || doc.section}": ${summary}`],
      draftAction: null,
      sourceType: 'deal_analysis',
      sourceId,
      category: 'document',
      blocking: false,
      severity: flagReason === 'expiration' ? 'high' : 'medium',
      sourceDocumentId: doc.id,
      correlationId: options.correlationId,
    });
    if (task) created.push(task);
  }

  return created;
}

// ── Readiness task generation (spec §7) ───────────────────────────────────────
// Auto-generates tasks for missing Digital Asset readiness requirements.
// Only fires for tokenization packs (or when digital_asset_enabled=true).
// Idempotent — never creates a duplicate of an open task of the same type+sourceId.
async function evaluateReadinessTasks(propertyId, existingTasks, options = {}) {
  const { data: room } = await supabase
    .from('deal_rooms')
    .select('workflow_pack_id, metadata_values, jurisdiction, checklist_items')
    .eq('property_id', propertyId)
    .maybeSingle();

  if (!room) return [];

  const isTokenization     = room.workflow_pack_id === 'tokenization';
  const digitalAssetEnabled = !!(room.metadata_values?.digital_asset_enabled);
  if (!isTokenization && !digitalAssetEnabled) return [];

  const existing = existingTasks || [];
  const hasExistingReadinessTask = (sourceId) => existing.some(t =>
    t.source_id === sourceId);

  const metaValues     = room.metadata_values || {};
  const checklistItems = Array.isArray(room.checklist_items) ? room.checklist_items : [];
  const created        = [];

  // 1) Missing issuance details — each unfilled field becomes its own task
  const ISSUANCE_FIELDS = [
    { key: 'raise_amount',   label: 'Raise Target'   },
    { key: 'token_price',    label: 'Token Price'    },
    { key: 'asset_type',     label: 'Asset Type'     },
    { key: 'min_investment', label: 'Minimum Investment' },
  ];
  for (const field of ISSUANCE_FIELDS) {
    if (metaValues[field.key]) continue; // already set — no task needed
    const sourceId = `readiness-issuance:${field.key}`;
    if (hasExistingReadinessTask(sourceId)) continue;
    const task = await createTask(propertyId, {
      taskType: 'readiness_setup',
      title: `Set ${field.label} in issuance details`,
      description: `${field.label} is required for a complete token offering and contributes to the Digital Asset Readiness score. Add it in Settings → Issuance Details.`,
      ownerType: 'ai',
      ownerRole: 'owner',
      evidence: [`metadata_values.${field.key} is empty`],
      sourceType: 'readiness',
      sourceId,
      category: 'readiness',
      blocking: true,
      severity: 'high',
      correlationId: options.correlationId,
    });
    if (task) created.push(task);
  }

  // 2) Jurisdiction not set
  if (!room.jurisdiction) {
    const sourceId = 'readiness-jurisdiction:missing';
    if (!hasExistingReadinessTask(sourceId)) {
      const task = await createTask(propertyId, {
        taskType: 'readiness_setup',
        title: 'Select a jurisdiction for this token offering',
        description: 'A jurisdiction is required to determine applicable regulatory requirements and compliance checklists. Set it in workspace Settings.',
        ownerType: 'ai',
        ownerRole: 'owner',
        evidence: ['deal_rooms.jurisdiction is null'],
        sourceType: 'readiness',
        sourceId,
        category: 'readiness',
        blocking: true,
        severity: 'high',
        correlationId: options.correlationId,
      });
      if (task) created.push(task);
    }
  } else {
    // 3) Regulatory documents not yet uploaded
    const UPLOADED = new Set(['uploaded', 'approved', 'ai_complete']);
    const regItems  = checklistItems.filter(i =>
      i.category === 'Regulatory' || (i.section || '').toLowerCase().includes('regulatory')
    );
    for (const item of regItems.filter(i => !UPLOADED.has(i.status)).slice(0, 3)) {
      const itemKey  = item.id || item.section || item.label || 'doc';
      const sourceId = `readiness-regulatory:${itemKey}`;
    if (hasExistingReadinessTask(sourceId)) continue;
      const task = await createTask(propertyId, {
        taskType: 'readiness_document',
        title: `Upload required regulatory document: ${item.label || item.section}`,
        description: `"${item.label || item.section}" is required for ${room.jurisdiction} regulatory preparation. Upload it in the Documents tab.`,
        ownerType: 'ai',
        ownerRole: 'owner',
        evidence: [`Regulatory checklist item "${item.label || item.section}" has status "${item.status || 'pending'}"`],
        sourceType: 'readiness',
        sourceId,
        category: 'readiness',
        blocking: true,
        severity: 'high',
        correlationId: options.correlationId,
      });
      if (task) created.push(task);
    }
  }

  return created;
}

module.exports = {
  listTasksForRoom,
  createTask,
  updateTaskStatus,
  approveTask,
  dismissTask,
  evaluateDealRoomForTasks,
  evaluateReadinessTasks,
};
