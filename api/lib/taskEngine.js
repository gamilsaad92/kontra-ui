// taskEngine.js — the "Task Engine + AI Ownership Layer" (Observe Mode)
//
// Product principle (see .agents/memory/kontra-index-split.md sibling context):
// every action in a workspace has an explicit owner — a human role (attorney,
// lender, owner, ...) or "ai" — and lives as a row in `tasks` with a status,
// evidence for *why* it exists, and (for AI-owned tasks) an optional
// draft_action the AI would take if approved. In Observe Mode, AI may only
// create/recommend tasks and draft actions — it may never execute a
// draft_action (e.g. send an email) without a human calling approveTask().
const { supabase } = require('../db');
const {
  DEFAULT_PACK_ID,
  getPackRoleConfig,
  getPackRoleLabel,
  getRoomPackId,
  sendResendEmail,
  logEvent,
} = require('./dealRoomHelpers');

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
          created_at    TIMESTAMPTZ DEFAULT NOW(),
          updated_at    TIMESTAMPTZ DEFAULT NOW()
        )
      `).then(() => _pg.query(`
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

const OPEN_STATUSES = ['pending', 'in_progress', 'escalated'];

// ── Role-specific reminder copy ───────────────────────────────────────────────
const ROLE_REMINDER_COPY = {
  inspector:    { verb: 'Submit Inspection Report →',    body: 'Your property inspection report is needed to complete due diligence. The deal cannot advance to underwriting until your inspection is on file.' },
  insurer:      { verb: 'Submit Insurance Certificate →', body: 'Insurance documentation is required before underwriting can begin. Please upload your certificate of coverage for this property.' },
  insurance_broker: { verb: 'Submit Insurance Certificate →', body: 'Insurance documentation is required before underwriting can begin. Please upload your certificate of coverage for this property.' },
  lender:       { verb: 'Submit Underwriting Package →', body: 'The deal is waiting on your underwriting review before it can advance to the loan committee stage. Please complete your submission when you have a moment.' },
  attorney:     { verb: 'Submit Legal Documents →',      body: 'Your legal review and any title-related documents are needed to move this deal forward. Please upload when ready.' },
  owner:        { verb: 'Submit Documents →',            body: 'Your documents are needed to keep this deal on track. Please complete your submission at your earliest convenience.' },
};

const SITE_URL = process.env.SITE_URL || 'https://kontraplatform.com';

function buildReminderEmailHtml({ name, roleLabel, roleKey, propertyName, propertyId }) {
  const copy = ROLE_REMINDER_COPY[roleKey] || ROLE_REMINDER_COPY.owner;
  const submitUrl = `${SITE_URL}/deal-room/${propertyId}?role=${roleKey}`;
  const displayName = name || roleLabel;
  const dealName = propertyName || 'your deal room';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px">
<tr><td>
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07)">

    <!-- Brand header -->
    <tr>
      <td style="background:#800020;padding:22px 32px">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background:rgba(255,255,255,0.15);border-radius:7px;padding:5px 11px">
            <span style="color:#ffffff;font-size:14px;font-weight:800;letter-spacing:-0.02em">K</span>
          </td>
          <td style="padding-left:10px">
            <span style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:-0.01em">Kontra</span>
          </td>
        </tr></table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:36px 32px 28px">
        <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;color:#800020;text-transform:uppercase;letter-spacing:0.1em">${dealName}</p>
        <h1 style="margin:0 0 24px 0;font-size:22px;font-weight:800;color:#111827;line-height:1.2">Your submission is needed.</h1>

        <p style="margin:0 0 14px 0;font-size:14px;color:#374151;line-height:1.7">Hi ${displayName},</p>
        <p style="margin:0 0 28px 0;font-size:14px;color:#374151;line-height:1.7">${copy.body}</p>

        <!-- CTA button -->
        <table cellpadding="0" cellspacing="0" style="margin:0 0 28px 0">
          <tr>
            <td style="background:#800020;border-radius:10px">
              <a href="${submitUrl}"
                style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:-0.01em">
                ${copy.verb}
              </a>
            </td>
          </tr>
        </table>

        <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
          Or copy this link into your browser:<br>
          <a href="${submitUrl}" style="color:#800020;word-break:break-all">${submitUrl}</a>
        </p>
      </td>
    </tr>

    <!-- Divider -->
    <tr><td style="height:1px;background:#f3f4f6"></td></tr>

    <!-- Footer -->
    <tr>
      <td style="padding:18px 32px">
        <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
          Sent by <a href="https://kontraplatform.com" style="color:#9ca3af;text-decoration:none">Kontra</a>
          · CRE Deal Intelligence · You were invited as the <strong>${roleLabel}</strong> for this deal room.
        </p>
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
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

async function createTask(propertyId, fields) {
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
  };
  const { data, error } = await supabase.from('deal_room_tasks').insert(row).select('*').single();
  if (error) { console.warn('[taskEngine] createTask:', error.message); return null; }
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
async function approveTask(taskId) {
  const { data: task, error } = await supabase.from('deal_room_tasks').select('*').eq('id', taskId).maybeSingle();
  if (error || !task) return { ok: false, error: 'Task not found' };
  if (task.status === 'completed') return { ok: false, error: 'Task already completed' };

  const action = task.draft_action;
  let emailSent = false;
  try {
    if (action?.type === 'email') {
      const RESEND_KEY = process.env.RESEND_API_KEY;
      if (RESEND_KEY) {
        await sendResendEmail(RESEND_KEY, {
          from: 'Kontra <notifications@kontraplatform.com>',
          to: action.to,
          subject: action.subject,
          html: action.html || `<p>${action.body || ''}</p>`,
        });
        emailSent = true;
      } else {
        console.warn('[taskEngine] approveTask: RESEND_API_KEY not set, skipping actual send');
      }
    }
    await updateTaskStatus(taskId, 'completed');
    logEvent(task.property_id, 'task_approved', 'owner', null,
      `Approved: ${task.title}`, { taskId, taskType: task.task_type }).catch(() => {});
    return { ok: true, propertyId: task.property_id, emailSent, emailTo: emailSent ? action.to : null };
  } catch (e) {
    console.warn('[taskEngine] approveTask failed:', e.message);
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
// creates a task if an open one of the same task_type+source doesn't already
// exist, so refreshing repeatedly doesn't spam duplicate tasks.
async function evaluateDealRoomForTasks(propertyId) {
  const packId = await getRoomPackId(propertyId);
  const roleConfig = getPackRoleConfig(packId);

  const [existingRes, submissionsRes, analysesRes, roomRes] = await Promise.all([
    supabase.from('deal_room_tasks').select('task_type, source_type, source_id, status').eq('property_id', propertyId),
    supabase.from('party_submissions').select('role, email, name, status, submitted_at').eq('property_id', propertyId),
    supabase.from('deal_analyses').select('id, section, filename, analysis, created_at').eq('property_id', propertyId),
    supabase.from('deal_rooms').select('property_name').eq('property_id', propertyId).maybeSingle(),
  ]);

  const propertyName = roomRes.data?.property_name || null;

  const existing = existingRes.data || [];
  const submissions = submissionsRes.data || [];
  const analyses = analysesRes.data || [];

  const hasOpenTask = (taskType, sourceId) => existing.some(t =>
    t.task_type === taskType && t.source_id === sourceId && OPEN_STATUSES.includes(t.status));

  const created = [];

  // 1) Missing required party — required role never invited/submitted.
  const requiredRoles = (roleConfig.roles || []).filter(r => r.required && r.needsDocs);
  for (const role of requiredRoles) {
    const sub = submissions.find(s => s.role === role.key);
    if (sub) continue;
    const sourceId = `missing-role:${role.key}`;
    if (hasOpenTask('missing_participant', sourceId)) continue;
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
    });
    if (task) created.push(task);
  }

  // 2) Stuck-pending submission — invited but hasn't submitted after being asked.
  for (const sub of submissions) {
    if (sub.status !== 'pending' && sub.status !== 'invited') continue;
    const sourceId = `pending-submission:${sub.role}`;
    if (hasOpenTask('pending_submission', sourceId)) continue;
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
        subject: `Action required: ${roleLabel} documents needed — ${propertyName || propertyId}`,
        body: (ROLE_REMINDER_COPY[sub.role] || ROLE_REMINDER_COPY.owner).body,
        html: buildReminderEmailHtml({
          name: sub.name,
          roleLabel,
          roleKey: sub.role,
          propertyName,
          propertyId,
        }),
      } : null,
      sourceType: 'party_submission',
      sourceId,
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
    if (hasOpenTask('document_flag', sourceId)) continue;
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
    });
    if (task) created.push(task);
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
};
