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

let _openai = null;
function getOpenAI() {
  if (!_openai && process.env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ── In-memory briefing cache (60s TTL) ───────────────────────────────────────
// Prevents double LLM calls when AIOperationsManager and TasksPanel both
// fetch /brain/briefing on the same page load.
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
    status: t.status,
    evidence: Array.isArray(t.evidence) ? t.evidence : [],
    hasDraftAction: !!t.draft_action,
    dueAt: t.due_at,
    createdAt: t.created_at,
  });

  return {
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
  };
}

function contextToPrompt(ctx) {
  return JSON.stringify(
    {
      deal: ctx.room,
      open_tasks: ctx.openTasks,
      recently_resolved_tasks: ctx.recentlyResolved,
    },
    null,
    2
  );
}

const GROUNDING_RULES = `You are the Operations Manager for a commercial real estate deal room.
You reason ONLY from the JSON context provided (open_tasks, recently_resolved_tasks, deal). Never invent
facts, people, dates, or documents not present in that context. If the context does not contain
enough information to answer, say so plainly instead of guessing.

Think like a senior banker: cite the specific task and evidence behind every claim.
CRITICAL PATH DISCIPLINE: most open tasks do not block closing. Identify only the 1-2 tasks
that actually gate the transaction advancing. Everything else is background noise. Always name
the owner of every cited task.`;

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

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${GROUNDING_RULES}

Produce a morning briefing as JSON:
{
  "status": "on_track" | "at_risk" | "blocked",
  "statusLabel": string (short, e.g. "On Track"),
  "expectedClosing": string|null (from deal.closingDate, human readable, or null if unknown),
  "criticalPath": [
    { "taskId": string, "owner": string, "item": string, "note": string }
  ]
  — ONLY the 1-2 tasks that directly gate closing. If nothing genuinely blocks closing, return [].
  — Most open tasks belong in nonBlockingTaskIds, not here.
  "nonBlockingTaskIds": [string]
  — IDs of open tasks that are NOT on the critical path (open but not blocking closing date).
  "taskRisks": { "[taskId]": "critical" | "high" | "medium" | "low" }
  — risk level for every open task. "critical" = directly blocks closing, "high" = will block soon,
    "medium" = important but not urgent, "low" = housekeeping / informational.
  "prepared": [string] (AI-owned tasks with draft_action, phrased as "Prepared reminder to [owner]"),
  "narrative": string (2-3 sentences: what matters and why — lead with the single most important fact.
    If everything is fine, say so confidently. Do NOT list tasks — the UI does that.)
}
If open_tasks is empty, return status "on_track", empty arrays, and a confident narrative.`,
        },
        { role: 'user', content: contextToPrompt(ctx) },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content || '{}');
    const result = {
      ...parsed,
      // keep backward-compat alias
      blocking: parsed.criticalPath || [],
      openTaskCount: ctx.openTasks.length,
      reviewedCount: ctx.openTasks.length + ctx.recentlyResolved.length,
    };
    setCache(propertyId, result);
    return result;
  } catch (err) {
    console.error('[operationsManager] getBriefing LLM error:', err.message);
    return fallback();
  }
}

function buildFallbackBriefing(ctx) {
  const critical = ctx.openTasks.filter(t => t.status === 'escalated');
  const criticalPath = critical.map(t => ({
    taskId: t.id, owner: t.ownedBy, item: t.title, note: t.description || ''
  }));
  const nonBlockingTaskIds = ctx.openTasks
    .filter(t => t.status !== 'escalated')
    .map(t => t.id);
  const taskRisks = {};
  ctx.openTasks.forEach(t => {
    taskRisks[t.id] = t.status === 'escalated' ? 'critical'
      : t.status === 'in_progress' ? 'high'
      : 'medium';
  });
  const prepared = ctx.openTasks
    .filter(t => t.hasDraftAction)
    .map(t => `Prepared draft for: ${t.title}`);
  return {
    status: criticalPath.length ? 'at_risk' : 'on_track',
    statusLabel: criticalPath.length ? 'At Risk' : 'On Track',
    expectedClosing: ctx.room?.closingDate || null,
    criticalPath,
    blocking: criticalPath,
    nonBlockingTaskIds,
    taskRisks,
    prepared,
    narrative: 'AI reasoning is temporarily unavailable — showing a plain readout of open tasks.',
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
{ "answer": string (direct answer — 1-4 sentences. If multiple tasks exist but only one matters,
  say which one matters and explicitly note the others are NOT blocking closing.
  Always name task owners. Always cite specific evidence.),
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
