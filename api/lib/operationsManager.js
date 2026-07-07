// operationsManager.js — the "Operations Manager" answer engine.
//
// Product principle: this is an answer engine grounded strictly in the Task
// Engine's rows (deal_room_tasks) plus deal_room evidence. It can answer any
// operational question about a workspace. It never fabricates facts.
const { supabase } = require('../db');
const {
  DEFAULT_PACK_ID,
  getPackRoleLabel,
  getPackStageLabel,
  getRoomPackId,
} = require('./dealRoomHelpers');
const { listTasksForRoom } = require('./taskEngine');

let _deps = null;
function getDependencies() {
  if (!_deps) {
    try { _deps = require('../../shared/taskDependencies.json'); }
    catch (e) { _deps = {}; }
  }
  return _deps;
}

let _openai = null;
function getOpenAI() {
  if (!_openai && process.env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ── In-memory briefing cache (60s TTL) ───────────────────────────────────────
const briefingCache = new Map();
const BRIEFING_TTL_MS = 60 * 1000;

function getCached(propertyId) {
  const entry = briefingCache.get(propertyId);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  briefingCache.delete(propertyId);
  return null;
}

function setCache(propertyId, data) {
  briefingCache.set(propertyId, { data, expiresAt: Date.now() + BRIEFING_TTL_MS });
}

// ── Dependency chain computation ──────────────────────────────────────────────
// Given a pack's closing chain and the current task list, determine:
//   • Which step is the active blocker
//   • Which tasks are on the critical path (their step is the earliest incomplete step)
//   • Which tasks are on parallel tracks (not in any chain step)

// Extract the "subject role" from a task — the party the task is about.
// owner_role stores who should ACTION the task ('owner'), not which party is absent.
// source_id encodes the subject: 'missing-role:inspector', 'pending-submission:lender', etc.
function subjectRoleOf(task) {
  const sid = task.source_id || task.sourceId || '';
  const m = sid.match(/^(?:missing-role|pending-submission):(.+)$/);
  if (m) return m[1];
  // Fallback: use owner_role if it's not a generic 'owner'/'ai' value
  const or = task.owner_role || task.ownerRole || '';
  return ['owner', 'ai'].includes(or) ? null : or;
}

function computeChainStatus(packId, tasks) {
  const deps = getDependencies();
  const packDeps = deps[packId] || deps[DEFAULT_PACK_ID] || null;
  if (!packDeps) return null;

  const { closingChain = [], parallelTracks = [] } = packDeps;

  const parallelRoleKeys = new Set(parallelTracks.flatMap(t => t.roleKeys));

  const OPEN = ['pending', 'in_progress', 'escalated'];

  // Annotate each chain step with its task state
  const chainSteps = closingChain.map(step => {
    if (step.roleKeys.length === 0) {
      // Terminal/admin step — status is derived from prior steps, not tasks
      return { ...step, tasks: [], openTasks: [], stepStatus: 'waiting', openCount: 0 };
    }
    const stepTasks = tasks.filter(t => step.roleKeys.includes(subjectRoleOf(t)));
    const openStepTasks = stepTasks.filter(t => OPEN.includes(t.status));
    const hasAnyTask = stepTasks.length > 0;
    let stepStatus;
    if (!hasAnyTask)                   stepStatus = 'pending';
    else if (openStepTasks.length > 0) stepStatus = 'in_progress';
    else                               stepStatus = 'complete';
    return { ...step, tasks: stepTasks, openTasks: openStepTasks, stepStatus, openCount: openStepTasks.length };
  });

  // Active step = first non-complete step that has role-based tasks required
  const activeStepIndex = chainSteps.findIndex(s =>
    s.roleKeys.length > 0 && s.stepStatus !== 'complete'
  );

  // Mark downstream steps as 'blocked' if an upstream step is incomplete
  const annotated = chainSteps.map((s, i) => ({
    ...s,
    stepStatus: i < activeStepIndex
      ? 'complete'
      : i === activeStepIndex
        ? s.stepStatus
        : (activeStepIndex !== -1 ? 'blocked' : s.stepStatus),
  }));

  // IDs of tasks on the critical path (open tasks in the active step)
  const activeStep = activeStepIndex !== -1 ? annotated[activeStepIndex] : null;
  const criticalTaskIds = new Set((activeStep?.openTasks || []).map(t => t.id));

  // IDs of tasks on parallel tracks (open tasks whose role is in parallelTracks)
  const parallelTaskIds = new Set(
    tasks.filter(t => OPEN.includes(t.status) && parallelRoleKeys.has(t.owner_role || t.ownerRole)).map(t => t.id)
  );

  return { chain: annotated, activeStep, criticalTaskIds, parallelTaskIds, totalSteps: closingChain.length };
}

// ── Grounding context ─────────────────────────────────────────────────────────
async function buildGroundedContext(propertyId) {
  const [{ data: room }, tasks] = await Promise.all([
    supabase
      .from('deal_rooms')
      .select('property_name, deal_stage, workflow_pack_id, closing_date, deal_type, deal_amount')
      .eq('property_id', propertyId)
      .maybeSingle(),
    listTasksForRoom(propertyId),
  ]);

  const packId = room?.workflow_pack_id || DEFAULT_PACK_ID;
  const stageLabel = room?.deal_stage ? getPackStageLabel(packId, room.deal_stage) : null;

  const openTasks = tasks.filter(t => ['pending', 'in_progress', 'escalated'].includes(t.status));
  const recentlyResolved = tasks
    .filter(t => ['completed', 'dismissed'].includes(t.status))
    .slice(0, 10);

  const describeTask = t => ({
    id: t.id,
    title: t.title,
    description: t.description || null,
    ownedBy: t.owner_type === 'ai' ? 'AI' : getPackRoleLabel(packId, t.owner_role || 'unknown'),
    ownerRole: t.owner_role,
    status: t.status,
    evidence: Array.isArray(t.evidence) ? t.evidence : [],
    hasDraftAction: !!t.draft_action,
    dueAt: t.due_at,
    createdAt: t.created_at,
  });

  const chainStatus = computeChainStatus(packId, tasks.map(t => ({ ...t, ownerRole: t.owner_role })));

  return {
    packId,
    room: room
      ? {
          propertyName: room.property_name,
          stage: stageLabel,
          dealType: room.deal_type,
          dealAmount: room.deal_amount,
          closingDate: room.closing_date,
        }
      : null,
    openTasks: openTasks.map(describeTask),
    recentlyResolved: recentlyResolved.map(describeTask),
    chainStatus,
  };
}

function contextToPrompt(ctx) {
  const chainSummary = ctx.chainStatus
    ? ctx.chainStatus.chain.map(s => ({
        step: s.step,
        label: s.label,
        status: s.stepStatus,
        openTaskTitles: (s.openTasks || []).map(t => t.title),
      }))
    : null;

  return JSON.stringify(
    {
      deal: ctx.room,
      closing_chain: chainSummary,
      open_tasks: ctx.openTasks,
      recently_resolved_tasks: ctx.recentlyResolved,
    },
    null,
    2
  );
}

const GROUNDING_RULES = `You are the Operations Manager for a commercial real estate deal room.
You reason ONLY from the JSON context provided (closing_chain, open_tasks, recently_resolved_tasks, deal). Never invent
facts, people, dates, or documents not present in that context. If the context does not contain
enough information to answer, say so plainly instead of guessing.

Think like a senior banker: cite the specific task and evidence behind every claim.

DEPENDENCY CHAIN REASONING: The closing_chain shows sequential steps where each step gates the next.
The earliest step that is NOT "complete" is the ACTIVE BLOCKER — tasks in that step are on the critical path.
Tasks in later steps are blocked and cannot progress until the active step clears.
Tasks in parallel tracks are open but do NOT gate the chain steps.

CRITICAL PATH DISCIPLINE: most open tasks do not block closing. Only tasks in the earliest incomplete
chain step are truly on the critical path. Everything else is background noise. Always name the owner.`;

// ── Morning briefing ──────────────────────────────────────────────────────────
async function getBriefing(propertyId) {
  const cached = getCached(propertyId);
  if (cached) return cached;

  const ctx = await buildGroundedContext(propertyId);
  const openai = getOpenAI();

  const fallback = () => {
    const result = buildFallbackBriefing(ctx);
    setCache(propertyId, result);
    return result;
  };
  if (!openai) return fallback();

  // Deterministically compute criticalPath + nonBlockingTaskIds from chain
  // before calling the LLM, so AI only provides narrative — never overrides structure.
  const chainStatus = ctx.chainStatus;
  const activeStep = chainStatus?.activeStep;
  const criticalTaskIds = chainStatus?.criticalTaskIds || new Set();
  const parallelTaskIds = chainStatus?.parallelTaskIds || new Set();

  const criticalPathDetermined = (activeStep?.openTasks || []).map(t => ({
    taskId: t.id,
    owner: t.owner_type === 'ai' ? 'AI' : getPackRoleLabel(ctx.packId, t.owner_role || 'unknown'),
    item: t.title,
    note: t.description || '',
    chainStep: activeStep.step,
  }));

  // Tasks in later chain steps (blocked) + parallel tracks = non-blocking
  const nonBlockingDetermined = ctx.openTasks
    .filter(t => !criticalTaskIds.has(t.id))
    .map(t => t.id);

  const taskRisksDetermined = {};
  ctx.openTasks.forEach(t => {
    taskRisksDetermined[t.id] = criticalTaskIds.has(t.id) ? 'critical'
      : parallelTaskIds.has(t.id) ? 'medium'
      : 'high'; // later chain steps — important, not yet actionable
  });

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${GROUNDING_RULES}

The critical path, task risks, and non-blocking tasks have already been computed from the dependency chain.
Your job is ONLY to provide:
1. The overall status and narrative
2. A parallel note (if relevant)
3. Any AI-prepared items

Respond as JSON:
{
  "status": "on_track" | "at_risk" | "blocked",
  "statusLabel": string (short, e.g. "On Track", "At Risk", "Blocked"),
  "expectedClosing": string|null,
  "narrative": string (2-3 sentences max. Name the active chain step (e.g. "Step 1: Due Diligence").
    Say what's blocking it and what the next step is once it clears.
    If all is clear, say so confidently. Do NOT list tasks.),
  "parallelNote": string|null
    (One sentence about tasks that are open but NOT on the critical path — e.g. attorney review.
     If nothing relevant, return null.),
  "prepared": [string]
}
The closing_chain in context shows which step is active. Focus only on the EARLIEST in_progress step.`,
        },
        { role: 'user', content: contextToPrompt(ctx) },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content || '{}');

    const result = {
      status:          parsed.status || (criticalPathDetermined.length ? 'at_risk' : 'on_track'),
      statusLabel:     parsed.statusLabel || (criticalPathDetermined.length ? 'At Risk' : 'On Track'),
      expectedClosing: parsed.expectedClosing || ctx.room?.closingDate || null,
      narrative:       parsed.narrative || null,
      parallelNote:    parsed.parallelNote || null,
      prepared:        parsed.prepared || [],
      // Always use deterministic values, never LLM-computed ones
      criticalPath:    criticalPathDetermined,
      blocking:        criticalPathDetermined,
      nonBlockingTaskIds: nonBlockingDetermined,
      taskRisks:       taskRisksDetermined,
      chain: chainStatus?.chain?.map(s => ({
        step: s.step, label: s.label, description: s.description,
        stepStatus: s.stepStatus, openCount: s.openCount || 0,
        totalSteps: chainStatus.totalSteps,
      })) || null,
      openTaskCount:  ctx.openTasks.length,
      reviewedCount:  ctx.openTasks.length + ctx.recentlyResolved.length,
    };
    setCache(propertyId, result);
    return result;
  } catch (err) {
    console.error('[operationsManager] getBriefing LLM error:', err.message);
    return fallback();
  }
}

function buildFallbackBriefing(ctx) {
  const { chainStatus } = ctx;
  const criticalTaskIds = chainStatus?.criticalTaskIds || new Set();

  const critical = ctx.openTasks.filter(t => criticalTaskIds.has(t.id));
  const nonCritical = ctx.openTasks.filter(t => !criticalTaskIds.has(t.id));

  const criticalPath = critical.map(t => ({
    taskId: t.id, owner: t.ownedBy, item: t.title, note: t.description || '',
    chainStep: chainStatus?.activeStep?.step || null,
  }));

  const nonBlockingTaskIds = nonCritical.map(t => t.id);
  const taskRisks = {};
  ctx.openTasks.forEach(t => {
    taskRisks[t.id] = criticalTaskIds.has(t.id)
      ? 'critical'
      : t.status === 'escalated' ? 'high'
      : t.status === 'in_progress' ? 'medium'
      : 'low';
  });

  const prepared = ctx.openTasks
    .filter(t => t.hasDraftAction)
    .map(t => `Prepared draft for: ${t.title}`);

  const activeStep = chainStatus?.activeStep;
  const narrative = activeStep
    ? `Step ${activeStep.step}: ${activeStep.label} is the active blocker — ${activeStep.openCount} task(s) need resolution before the next step can begin.`
    : criticalPath.length
      ? 'AI reasoning is temporarily unavailable — showing a plain readout of open tasks.'
      : 'All tasks are resolved. The transaction is on track.';

  return {
    status: criticalPath.length ? 'at_risk' : 'on_track',
    statusLabel: criticalPath.length ? 'At Risk' : 'On Track',
    expectedClosing: ctx.room?.closingDate || null,
    criticalPath,
    blocking: criticalPath,
    nonBlockingTaskIds,
    parallelNote: nonCritical.length > 0
      ? `${nonCritical.length} other task(s) are open but run parallel and do not gate the current step.`
      : null,
    taskRisks,
    prepared,
    narrative,
    chain: chainStatus?.chain?.map(s => ({
      step: s.step, label: s.label, description: s.description,
      stepStatus: s.stepStatus, openCount: s.openCount || 0,
      totalSteps: chainStatus.totalSteps,
    })) || null,
    openTaskCount: ctx.openTasks.length,
    reviewedCount: ctx.openTasks.length + ctx.recentlyResolved.length,
  };
}

// ── Answer engine ─────────────────────────────────────────────────────────────
async function askQuestion(propertyId, question) {
  if (!question || !question.trim()) {
    return { answer: 'Ask a question about this workspace — e.g. "What\'s blocking closing?" or "What should happen next?"', citedTaskIds: [] };
  }
  const ctx = await buildGroundedContext(propertyId);
  const openai = getOpenAI();

  if (!openai) {
    return {
      answer: `AI reasoning is temporarily unavailable. There are ${ctx.openTasks.length} open task(s) in this workspace.`,
      citedTaskIds: ctx.openTasks.map(t => t.id),
    };
  }

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${GROUNDING_RULES}

Answer the user's operational question. Respond as JSON:
{ "answer": string (direct answer — 1-4 sentences. Use the closing_chain to distinguish what's truly blocking
  from what's parallel. If only one step is the blocker, say which one it is and explicitly note
  the others are NOT blocking closing. Always name task owners. Always cite specific evidence.),
  "citedTaskIds": [ string ] }
If the question cannot be answered from context, say so directly.`,
        },
        { role: 'user', content: `Workspace context:\n${contextToPrompt(ctx)}\n\nQuestion: ${question}` },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content || '{}');
    return {
      answer: parsed.answer || 'I could not generate an answer from the current workspace data.',
      citedTaskIds: Array.isArray(parsed.citedTaskIds) ? parsed.citedTaskIds : [],
    };
  } catch (err) {
    console.error('[operationsManager] askQuestion LLM error:', err.message);
    return { answer: 'Something went wrong answering that question. Please try again.', citedTaskIds: [] };
  }
}

module.exports = {
  buildGroundedContext,
  getBriefing,
  askQuestion,
};
