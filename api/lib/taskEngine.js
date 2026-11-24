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
const { TRANSACTION_NOTIFICATION_FROM } = require('./emailConfig');
const { emit } = require('./eventBus');
const { selectActiveDocumentVersions } = require('./documentVersions');
const { loadTaskSubmissions } = require('./taskSubmissionQuery');
const {
  getRecordRemediationPlan,
} = require('./recordRemediation');
const { resolveParticipantCompletions } = require('./participantCompletion');
const { resolveRoomChecklist } = require('./customPackChecklist');
const { projectDocumentChecklist } = require('./documentStatus');
const { getChecklistItemAssignedRoles } = require('./documentAssignmentAccess');
const {
  buildChecklistRequirementPlan,
  filterTasksForRoom,
  isDigitalAssetReadinessApplicable,
} = require('./taskRelevance');

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

async function getLiveRoleConfig(packId) {
  if (!String(packId || '').startsWith('ws_')) return getPackRoleConfig(packId);
  try {
    const { data, error } = await supabase
      .from('custom_workflow_packs')
      .select('config')
      .eq('id', packId)
      .maybeSingle();
    if (error) throw error;
    return data?.config && Array.isArray(data.config.roles)
      ? data.config
      : { roles: [] };
  } catch (error) {
    // Never evaluate a custom room against the built-in CRE participant list.
    console.warn('[taskEngine] live participant configuration unavailable:', error.message);
    return { roles: [] };
  }
}

async function getTaskRoomContext(propertyId, includeReadinessFields = false) {
  const { data: room, error } = await supabase
    .from('deal_rooms')
    .select(includeReadinessFields
      ? 'workflow_pack_id, deal_type, metadata_values, jurisdiction, checklist_items, deal_stage'
      : 'workflow_pack_id, deal_type, metadata_values')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (error) throw error;
  if (!room) return { room: null, customPackConfig: null };

  let customPackConfig = null;
  if (String(room.workflow_pack_id || '').startsWith('ws_')) {
    const { data, error: packError } = await supabase
      .from('custom_workflow_packs')
      .select('config')
      .eq('id', room.workflow_pack_id)
      .maybeSingle();
    if (packError) {
      console.warn('[taskEngine] custom pack applicability unavailable:', packError.message);
    } else {
      customPackConfig = data?.config || null;
    }
  }
  return { room, customPackConfig };
}

async function loadTaskDocumentAnalyses(propertyId) {
  const selects = [
    'id, section, filename, analysis, created_at, storage_path, processing_status, is_active, superseded_at, superseded_by, post_completion',
    'id, section, filename, analysis, created_at, storage_path, processing_status, is_active, superseded_at',
    'id, section, filename, analysis, created_at, storage_path, processing_status',
    'id, section, filename, analysis, created_at',
  ];
  let lastError = null;
  for (const select of selects) {
    const result = await supabase
      .from('deal_analyses')
      .select(select)
      .eq('property_id', propertyId);
    if (!result.error) return result.data || [];
    lastError = result.error;
    if (!/column|schema cache|does not exist|could not find/i.test(result.error.message || '')) {
      throw result.error;
    }
  }
  if (lastError) throw lastError;
  return [];
}

const OPEN_TASK_STATUSES = new Set(['pending', 'in_progress', 'escalated']);

function parseTaskEvidence(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(item => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return value.trim() ? [value.trim()] : [];
  }
}

async function resolveMissingParticipantTask(propertyId, task, roleKey, submissionPresent) {
  if (!task?.id || !OPEN_TASK_STATUSES.has(task.status)) return null;
  const evidence = parseTaskEvidence(task.evidence);
  const resolutionEvidence = submissionPresent
    ? `A party_submissions record is now present for role "${roleKey}".`
    : `The accepted "${roleKey}" participant completed all assigned required documents.`;
  if (evidence.includes(resolutionEvidence)) return null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('deal_room_tasks')
    .update({
      status: 'completed',
      evidence: JSON.stringify([...evidence, resolutionEvidence]),
      resolved_at: now,
      updated_at: now,
    })
    .eq('property_id', propertyId)
    .eq('id', task.id)
    .eq('status', task.status)
    .select('*')
    .maybeSingle();
  if (error) {
    console.warn('[taskEngine] missing-participant task reconciliation failed', {
      code: error.code || 'unknown',
    });
    return null;
  }
  if (!data) return null;

  emit('task.updated', {
    propertyId, taskId: task.id, taskType: task.task_type,
    status: 'completed', sourceId: task.source_id,
  }, { source: 'task-engine' });
  logEvent(propertyId, 'task_auto_resolved', 'system', null,
    `Resolved missing participant submission task for role "${roleKey}"`, {
      taskId: task.id, taskType: task.task_type, sourceId: task.source_id,
      resolution: submissionPresent ? 'submission_recorded' : 'participant_requirements_complete',
    }).catch(() => {});
  return data;
}

const INSPECTION_ACTION_WORDS = /\b(?:repair|replace|remediate|correct|remove|install|evaluate|obtain|provide|secure|complete|follow[\s-]?up|schedule|recommend|address|resolve|mitigate|upgrade|service|rebuild|restore|verify|confirm|engage|consult|maintain)\b/i;
const INSPECTION_DIRECTIVE_PATTERN = /\b(?:should|must|needs?\s+to|requires?\s+(?:that\s+)?|recommended\s+to|calls?\s+for)\s+(?:be\s+)?(?:inspected|tested|monitored|reviewed|documented|repaired|replaced|remediated|corrected|addressed|verified|confirmed)\b|\b(?:inspection|testing|monitoring|review|documentation)\s+(?:is\s+)?(?:required|recommended|needed)\b/i;
const INSPECTION_DEFICIENCY_WORDS = /\b(?:deficien(?:cy|t)|hazard|unsafe|damaged|crack(?:ed)?|leak(?:ing)?|missing|failed|deteriorat(?:ed|ing)|mold|asbestos|fire[\s-]?safety|life[\s-]?safety|violation|non[\s-]?compliant|repair[\s-]?required)\b/i;

function findingText(item) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  return String(
    item.action
      || item.recommended_action
      || item.recommendedAction
      || item.item
      || item.finding
      || item.issue
      || item.deficiency
      || item.title
      || item.description
      || item.text
      || '',
  ).trim();
}

function findingDetails(item, primary) {
  if (!item || typeof item !== 'object') return '';
  const details = [
    item.description,
    item.details,
    item.timeline,
    item.estimatedCost || item.estimated_cost,
  ].map(value => String(value || '').trim()).filter(Boolean);
  return [...new Set(details)].filter(value => value !== primary).join(' · ');
}

function findingSeverity(value, fallback = 'medium') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['critical', 'high', 'urgent'].includes(normalized)) return 'high';
  if (['low', 'minor'].includes(normalized)) return 'low';
  if (['medium', 'moderate'].includes(normalized)) return 'medium';
  return fallback;
}

function buildInspectionActionCandidates(analysis = {}) {
  const candidates = [];
  const add = (kind, item, actionableBySchema = false) => {
    const primary = findingText(item);
    if (!primary) return;
    const detail = findingDetails(item, primary);
    const text = [primary, detail].filter(Boolean).join(' — ').slice(0, 900);
    const explicitAction = item && typeof item === 'object'
      && (item.actionable === true || item.requires_action === true || item.requiresAction === true);
    const highPriorityFlag = ['critical', 'high'].includes(
      String(item?.severity || item?.priority || '').trim().toLowerCase(),
    );
    if (!actionableBySchema && !explicitAction && !highPriorityFlag
      && !INSPECTION_ACTION_WORDS.test(text)
      && !INSPECTION_DIRECTIVE_PATTERN.test(text)
      && !INSPECTION_DEFICIENCY_WORDS.test(text)) return;
    candidates.push({
      kind,
      primary: primary.slice(0, 140),
      text,
      severity: findingSeverity(item?.severity || item?.priority, kind === 'life_safety' ? 'high' : 'medium'),
      page: Number.isInteger(Number(item?.source_page ?? item?.page))
        ? Number(item?.source_page ?? item?.page)
        : null,
    });
  };

  (Array.isArray(analysis.lifeSafetyFindings) ? analysis.lifeSafetyFindings : [])
    .forEach(item => add('life_safety', item, true));
  (Array.isArray(analysis.deferredMaintenance) ? analysis.deferredMaintenance : [])
    .forEach(item => {
      const priority = String(item?.priority || '').toLowerCase();
      add('deferred_maintenance', item, priority === 'high' || priority === 'medium');
    });
  (Array.isArray(analysis.priorityActions) ? analysis.priorityActions : [])
    .forEach(item => add('priority_action', item, true));

  // Prefer the specific inspection schema when it is present. Generic custom
  // pack analyses use risk_flags/recommendations; flags alone are not tasks
  // unless they carry explicit action or clear deficiency language.
  if (candidates.length === 0) {
    (Array.isArray(analysis.recommendations) ? analysis.recommendations : [])
      .forEach(item => add('recommendation', item, false));
    (Array.isArray(analysis.risk_flags) ? analysis.risk_flags : [])
      .forEach(item => add('risk_flag', item, false));
  }

  const unique = new Map();
  for (const candidate of candidates) {
    const identity = candidate.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (identity && !unique.has(identity)) unique.set(identity, candidate);
  }
  return [...unique.values()];
}

function inspectionOwnerRole(checklist, roleConfig, section) {
  const normalizedSection = String(section || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const item = (Array.isArray(checklist) ? checklist : []).find(candidate =>
    [candidate?.section, candidate?.id, candidate?.document_id, candidate?.documentId]
      .some(value => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_') === normalizedSection)
  );
  const validRoles = new Set((roleConfig?.roles || []).map(role => String(role.key || '').trim()));
  const assigned = getChecklistItemAssignedRoles(item, null, null);
  return {
    item,
    role: assigned.find(role => role === 'owner' || validRoles.has(role)) || 'owner',
  };
}

function inspectionFindingSourceId(text) {
  const identity = String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const fingerprint = crypto.createHash('sha256').update(identity).digest('hex').slice(0, 24);
  return `inspection-follow-up:${fingerprint}`;
}

async function updateInspectionTaskForReplacement(propertyId, task, document, candidate, ownerRole) {
  if (!task?.id || !OPEN_TASK_STATUSES.has(task.status) || task.source_document_id === document.id) return null;
  const evidence = parseTaskEvidence(task.evidence);
  const replacementNote = `The same follow-up appears in a newer active inspection analysis: ${candidate.text}`;
  if (evidence.includes(replacementNote)) return null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('deal_room_tasks')
    .update({
      evidence: JSON.stringify([...evidence, replacementNote]),
      source_document_id: document.id,
      title: `Inspection follow-up: ${candidate.primary}`.slice(0, 180),
      owner_role: ownerRole,
      severity: candidate.severity,
      updated_at: now,
    })
    .eq('property_id', propertyId)
    .eq('id', task.id)
    .eq('status', task.status)
    .select('*')
    .maybeSingle();
  if (error) {
    console.warn('[taskEngine] inspection replacement reconciliation failed', {
      code: error.code || 'unknown',
    });
    return null;
  }
  return data || null;
}

async function reconcileInspectionFollowUpTasks({
  propertyId, analyses, checklist, roleConfig, room, existing, options,
}) {
  const seenSources = new Set();
  const completedAnalysis = (Array.isArray(analyses) ? analyses : [])
    .filter(document => /inspection/i.test(`${document.section || ''} ${document.filename || ''}`)
      && !['pending', 'processing', 'failed', 'superseded'].includes(
        String(document.processing_status || '').toLowerCase(),
      )
      && document.analysis?.pending !== true)
    .sort((left, right) => Date.parse(right.created_at || 0) - Date.parse(left.created_at || 0));

  const created = [];
  for (const document of completedAnalysis) {
    const candidates = buildInspectionActionCandidates(document.analysis || {});
    const assignment = inspectionOwnerRole(checklist, roleConfig, document.section);
    const workflowStage = assignment.item?.workflow_stage
      || assignment.item?.stage_key
      || assignment.item?.stageKey
      || null;
    const currentStage = room?.deal_stage || null;
    if (workflowStage && currentStage
      && String(workflowStage).trim().toLowerCase().replace(/[\s-]+/g, '_')
        !== String(currentStage).trim().toLowerCase().replace(/[\s-]+/g, '_')) continue;
    for (const candidate of candidates) {
      const sourceId = inspectionFindingSourceId(candidate.primary);
      if (seenSources.has(sourceId)) continue;
      seenSources.add(sourceId);
      const existingTask = (existing || []).find(task =>
        task.task_type === 'inspection_follow_up' && task.source_id === sourceId
      );
      if (existingTask) {
        await updateInspectionTaskForReplacement(
          propertyId,
          existingTask,
          document,
          candidate,
          assignment.role,
        );
        continue;
      }
      const task = await createTask(propertyId, {
        taskType: 'inspection_follow_up',
        title: `Inspection follow-up: ${candidate.primary}`.slice(0, 180),
        description: 'AI suggested a follow-up based on the inspection analysis. Review the linked source document before acting.',
        ownerType: 'ai',
        ownerRole: assignment.role,
        evidence: [
          `AI inspection ${candidate.kind.replace(/_/g, ' ')} (not independently verified): ${candidate.text}`,
          `Source document record: ${document.id}`,
        ],
        sourceType: 'inspection_analysis',
        sourceId,
        category: 'inspection',
        blocking: false,
        severity: candidate.severity,
        sourceDocumentId: document.id,
        sourcePage: candidate.page,
        sourceAgent: 'inspection-analysis',
        correlationId: options.correlationId,
      });
      if (task) created.push(task);
    }
  }
  return created;
}

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

async function listApplicableTasksForRoom(propertyId) {
  const [tasks, context] = await Promise.all([
    listTasksForRoom(propertyId),
    getTaskRoomContext(propertyId),
  ]);
  return filterTasksForRoom(tasks, context.room, context.customPackConfig);
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

async function reconcileRecordRemediationTasks(propertyId, recordState, existingTasks, options = {}) {
  const plan = getRecordRemediationPlan(recordState, existingTasks || []);
  const reconciled = [];

  for (const { task, existing } of plan.upsert) {
    const payload = {
      title: task.title,
      description: task.description,
      owner_type: 'human',
      owner_role: 'owner',
      status: 'pending',
      evidence: JSON.stringify(task.evidence),
      source_type: 'transaction_record',
      source_id: task.sourceId,
      category: 'transaction_record',
      severity: 'high',
      blocking: true,
      resolved_at: null,
      execution_status: null,
      execution_result: null,
      executed_at: null,
      decision: null,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      const { data, error } = await supabase.from('deal_room_tasks')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .maybeSingle();
      if (error) console.warn('[taskEngine] update record remediation:', error.message);
      if (data) reconciled.push(data);
      continue;
    }
    const createdTask = await createTask(propertyId, {
      ...task,
      correlationId: options.correlationId,
    });
    if (createdTask) reconciled.push(createdTask);
  }

  for (const task of plan.dismiss) {
    if (['dismissed', 'completed'].includes(task.status)) continue;
    const { data, error } = await supabase.from('deal_room_tasks')
      .update({
        status: 'dismissed',
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id)
      .select('*')
      .maybeSingle();
    if (error) console.warn('[taskEngine] dismiss stale record remediation:', error.message);
    if (data) reconciled.push(data);
  }
  return reconciled;
}

async function reconcileChecklistRequirementTasks(propertyId, plan) {
  const resolved = [];
  for (const { task, status, completionEvidence } of plan.resolve) {
    const now = new Date().toISOString();
    const updates = {
      status,
      resolved_at: now,
      updated_at: now,
    };
    if (status === 'completed' && typeof completionEvidence === 'string' && completionEvidence.trim()) {
      const existingEvidence = Array.isArray(task.evidence)
        ? task.evidence
        : task.evidence ? [task.evidence] : [];
      updates.evidence = existingEvidence.includes(completionEvidence)
        ? existingEvidence
        : [...existingEvidence, completionEvidence];
    }
    const { data, error } = await supabase.from('deal_room_tasks')
      .update(updates)
      .eq('id', task.id)
      .eq('property_id', propertyId)
      .eq('status', task.status)
      .select('*')
      .maybeSingle();
    if (error) {
      console.warn('[taskEngine] resolve checklist task:', error.message);
      continue;
    }
    if (data) resolved.push(data);
  }
  return resolved;
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
        from: TRANSACTION_NOTIFICATION_FROM,
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
  const { readTransactionState } = require('./transactionState');
  const packId = await getRoomPackId(propertyId);
  const roleConfig = await getLiveRoleConfig(packId);

  const [existingRes, submissionsRes, documentAnalyses, invitesRes] = await Promise.all([
    supabase.from('deal_room_tasks').select('*').eq('property_id', propertyId),
    loadTaskSubmissions(supabase, propertyId),
    loadTaskDocumentAnalyses(propertyId),
    supabase.from('deal_room_invites').select('role_key, status, expires_at, revoked_at').eq('property_id', propertyId),
  ]);

  const existing = existingRes.data || [];
  const liveRoleKeys = new Set((roleConfig.roles || []).map(role => role.key));
  const submissions = (submissionsRes.data || []).filter(submission =>
    liveRoleKeys.has(submission.role)
  );
  const analyses = selectActiveDocumentVersions(documentAnalyses);
  const transactionState = await readTransactionState(propertyId);
  const room = transactionState.room || {};
  const checklist = await resolveRoomChecklist(room, supabase);
  const participantCompletions = resolveParticipantCompletions(roleConfig.roles || [], {
    checklist: projectDocumentChecklist(checklist, documentAnalyses).items,
    invites: invitesRes.data || [],
    submissions,
  });
  const completedParticipantRoles = new Set(
    participantCompletions.filter(state => state.complete).map(state => state.role)
  );

  const hasExistingTask = (taskType, sourceId) => existing.some(t =>
    t.task_type === taskType && t.source_id === sourceId);

  const created = [];
  created.push(...await reconcileRecordRemediationTasks(
    propertyId,
    transactionState.recordState,
    existing,
    options,
  ));

  // 1) Missing required party — required role has no submission record.
  const requiredRoles = (roleConfig.roles || []).filter(r =>
    r.required && r.needsDocs && r.invitable !== false && r.canManage !== true && !r.legacyOnly
  );
  for (const role of requiredRoles) {
    const sub = submissions.find(s => s.role === role.key);
    const sourceId = `missing-role:${role.key}`;
    const existingTask = existing.find(task =>
      task.task_type === 'missing_participant' && task.source_id === sourceId
    );
    if (sub || completedParticipantRoles.has(role.key)) {
      if (existingTask) {
        await resolveMissingParticipantTask(
          propertyId,
          existingTask,
          role.key,
          Boolean(sub),
        );
      }
      continue;
    }
    if (existingTask || hasExistingTask('missing_participant', sourceId)) continue;
    const roleLabel = role.label || getPackRoleLabel(packId, role.key);
    const task = await createTask(propertyId, {
      taskType: 'missing_participant',
      title: `${roleLabel} has no participant submission on record`,
      description: `The ${roleLabel} role is required for this deal type, but party_submissions has no record for this role.`,
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

  // 2) Stuck-pending submission — a submission row exists but is not complete.
  for (const sub of submissions) {
    if (completedParticipantRoles.has(sub.role)) continue;
    if (sub.status !== 'pending' && sub.status !== 'invited') continue;
    const sourceId = `pending-submission:${sub.role}`;
    if (hasExistingTask('pending_submission', sourceId)) continue;
    const roleLabel = roleConfig.roles.find(role => role.key === sub.role)?.label
      || getPackRoleLabel(packId, sub.role);
    const task = await createTask(propertyId, {
      taskType: 'pending_submission',
      title: `${roleLabel} has a pending participant submission`,
      description: `${sub.name || roleLabel} has a party_submissions record with status "${sub.status}" but has not completed the submission.`,
      ownerType: 'ai',
      ownerRole: sub.role,
      evidence: [`party_submissions.status = "${sub.status}" for role "${sub.role}" (submission not yet complete).`],
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

  created.push(...await reconcileInspectionFollowUpTasks({
    propertyId,
    analyses,
    checklist,
    roleConfig,
    room,
    existing,
    options,
  }));

  const checklistPlan = buildChecklistRequirementPlan({
    room: { ...room, checklist_items: checklist },
    activeAnalyses: analyses,
    documentAnalyses,
    existingTasks: existing,
    roleConfig,
  });
  created.push(...await reconcileChecklistRequirementTasks(propertyId, checklistPlan));
  for (const fields of checklistPlan.create) {
    const task = await createTask(propertyId, {
      ...fields,
      correlationId: options.correlationId,
    });
    if (task) created.push(task);
  }

  return created;
}

// ── Readiness task generation (spec §7) ───────────────────────────────────────
// Generates Digital Asset preparation tasks only for tokenization workflows or
// rooms with the explicit digital_asset_enabled opt-in.
// Idempotent — never creates a duplicate of an open task of the same type+sourceId.
async function evaluateReadinessTasks(propertyId, existingTasks, options = {}) {
  const { room, customPackConfig } = await getTaskRoomContext(propertyId, true);
  if (!room) return [];

  if (!isDigitalAssetReadinessApplicable(room, customPackConfig)) return [];

  const existing = existingTasks || [];
  const hasExistingReadinessTask = (sourceId) => existing.some(t =>
    t.source_id === sourceId);

  const metaValues     = room.metadata_values || {};
  const checklistItems = Array.isArray(room.checklist_items) ? room.checklist_items : [];
  const created        = [];

  // 1) Missing issuance details — each unfilled field becomes its own task
  const ISSUANCE_FIELDS = [
    { key: 'raise_amount',   valueKeys: ['raise_amount', 'raise_target'], label: 'Raise Target' },
    { key: 'token_price',    valueKeys: ['token_price'], label: 'Token Price' },
    { key: 'asset_type',     valueKeys: ['asset_type'], label: 'Asset Type' },
    { key: 'min_investment', valueKeys: ['min_investment'], label: 'Minimum Investment' },
  ];
  for (const field of ISSUANCE_FIELDS) {
    if (field.valueKeys.some(key => {
      const value = metaValues[key];
      return value !== null && value !== undefined && String(value).trim() !== '';
    })) continue;
    const sourceId = `readiness-issuance:${field.key}`;
    if (hasExistingReadinessTask(sourceId)) continue;
    const task = await createTask(propertyId, {
      taskType: 'readiness_setup',
      title: `Set ${field.label} in issuance details`,
      description: `${field.label} is required for a complete token offering and contributes to the Digital Asset Readiness score. Add it in Settings → Issuance Details.`,
      ownerType: 'ai',
      ownerRole: 'owner',
      evidence: [`metadata_values.${field.valueKeys.join(' or metadata_values.')} is empty`],
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
    const roleConfig = await getLiveRoleConfig(room.workflow_pack_id);
    const configuredRoles = new Set((roleConfig.roles || []).map(role => role.key));
    const regItems  = checklistItems.filter(i =>
      i.category === 'Regulatory' || (i.section || '').toLowerCase().includes('regulatory')
    );
    for (const item of regItems.filter(i => !UPLOADED.has(i.status)).slice(0, 3)) {
      const itemKey  = item.id || item.section || item.label || 'doc';
      const sourceId = `readiness-regulatory:${itemKey}`;
      const existingChecklistTask = existing.some(task =>
        task.task_type === 'missing_document'
          && task.source_type === 'workflow_checklist'
          && (task.source_id === `workflow-checklist:${itemKey}`
            || (item.id && task.source_document_id === item.id))
      );
      if (hasExistingReadinessTask(sourceId) || existingChecklistTask) continue;
      const assignedRoles = Array.isArray(item.assignedTo) ? item.assignedTo : [];
      const ownerRole = assignedRoles.find(role => role === 'owner' || configuredRoles.has(role)) || 'owner';
      const task = await createTask(propertyId, {
        taskType: 'readiness_document',
        title: `Upload required regulatory document: ${item.label || item.section}`,
        description: `"${item.label || item.section}" is required for ${room.jurisdiction} regulatory preparation. Upload it in the Documents tab.`,
        ownerType: 'ai',
        ownerRole,
        sourceDocumentId: item.id || item.document_id || item.documentId || null,
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
  listApplicableTasksForRoom,
  createTask,
  updateTaskStatus,
  approveTask,
  dismissTask,
  evaluateDealRoomForTasks,
  evaluateReadinessTasks,
  reconcileRecordRemediationTasks,
  getTaskRoomContext,
  reconcileChecklistRequirementTasks,
};
