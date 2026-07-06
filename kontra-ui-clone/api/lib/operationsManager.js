// operationsManager.js — the "AI Operations Manager" (formerly "Workspace
// Brain") answer engine.
//
// Product principle (per advisor guidance, see
// .agents/memory/kontra-task-architecture.md): this is NOT a dashboard that
// summarizes tasks. It is an answer engine — grounded strictly in the Task
// Engine's rows (deal_room_tasks) plus deal_room/deal_analyses evidence — that
// can answer any operational question about a workspace ("What's blocking
// closing?", "What changed?", "Who's holding this up?", "What should happen
// next?"). It never fabricates facts: every answer must be traceable to a
// task, its evidence, or the deal room record. If the grounding data doesn't
// support an answer, it says so instead of guessing.
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

// ── Grounding context ────────────────────────────────────────────────────
// Everything the AI is allowed to reason about. No other source of truth.
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

const GROUNDING_RULES = `You are the AI Operations Manager for a commercial real estate deal room.
You reason ONLY from the JSON context provided (open_tasks, recently_resolved_tasks, deal). Never invent
facts, people, dates, or documents that are not present in that context. If the context does not contain
enough information to answer, say so plainly instead of guessing.

Think like a banker, not a confidence score: cite the specific task/evidence behind every claim
(e.g. "Attorney has not uploaded Schedule B, due 2 days ago" rather than "some documents are missing").
Distinguish tasks that are actually on the critical path to closing from tasks that are open but not
blocking anything. Every open task has an explicit owner — a human role or "AI" — always name the owner.`;

// ── Morning briefing (the default view, no question asked) ─────────────────
async function getBriefing(propertyId) {
  const ctx = await buildGroundedContext(propertyId);
  const openai = getOpenAI();

  const fallback = () => buildFallbackBriefing(ctx);
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
  "blocking": [ { "taskId": string, "owner": string, "item": string, "note": string } ]
    (only tasks that are genuinely on the critical path to closing — omit tasks that are open but not blocking),
  "prepared": [ string ] (AI-owned tasks with a draft_action awaiting approval, phrased as what AI already prepared),
  "narrative": string (2-3 sentences, reasoning not reporting — explain WHY the status is what it is)
}
If open_tasks is empty, status should be "on_track" and blocking/prepared should be empty arrays.`,
        },
        { role: 'user', content: contextToPrompt(ctx) },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content || '{}');
    return { ...parsed, groundedTaskCount: ctx.openTasks.length };
  } catch (err) {
    console.error('[operationsManager] getBriefing LLM error:', err.message);
    return fallback();
  }
}

function buildFallbackBriefing(ctx) {
  const blocking = ctx.openTasks
    .filter(t => t.status === 'escalated' || t.status === 'pending')
    .map(t => ({ taskId: t.id, owner: t.ownedBy, item: t.title, note: t.description || '' }));
  const prepared = ctx.openTasks
    .filter(t => t.hasDraftAction)
    .map(t => `Draft prepared for: ${t.title}`);
  return {
    status: blocking.length ? 'at_risk' : 'on_track',
    statusLabel: blocking.length ? 'At Risk' : 'On Track',
    expectedClosing: ctx.room?.closingDate || null,
    blocking,
    prepared,
    narrative: openaiUnavailableNote(),
    groundedTaskCount: ctx.openTasks.length,
  };
}

function openaiUnavailableNote() {
  return 'AI reasoning is unavailable right now, so this is a plain readout of open tasks rather than a reasoned summary.';
}

// ── Answer engine (free-form question) ──────────────────────────────────────
async function askQuestion(propertyId, question) {
  if (!question || !question.trim()) {
    return { answer: 'Ask a question about this workspace — e.g. "What\'s blocking closing?" or "What should happen next?"', citedTaskIds: [] };
  }
  const ctx = await buildGroundedContext(propertyId);
  const openai = getOpenAI();

  if (!openai) {
    return {
      answer: `${openaiUnavailableNote()} There are ${ctx.openTasks.length} open task(s) in this workspace.`,
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

Answer the user's operational question about this workspace. Respond as JSON:
{ "answer": string (direct, reasoned answer — 1-4 sentences, may use short bullet-style lines separated by newlines),
  "citedTaskIds": [ string ] (ids of open_tasks or recently_resolved_tasks referenced in the answer) }
If the question cannot be answered from the provided context, say so directly in "answer" and return an empty citedTaskIds array.`,
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
