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
const {
  isTokenizationQuestion,
  buildTokenizationGuidance,
  buildTokenizationPrompt,
  buildTokenizationAnswerPrefix,
} = require('./tokenizationGuidance');

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
  const [roomResult, tasks, { data: analyses }, { data: recordFields }, { data: participants }] = await Promise.all([
    supabase
      .from('deal_rooms')
      .select('property_name, deal_stage, closing_date, deal_type, deal_amount, workflow_pack_id, jurisdiction, metadata_values, checklist_items, settlement_mode, settlement_readiness_pct, settlement_mode_locked_at, sealed_at, completed_at')
      .eq('property_id', propertyId)
      .maybeSingle(),
    listTasksForRoom(propertyId),
    supabase
      .from('deal_analyses')
      .select('section, filename, analysis, created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('transaction_record_fields')
      .select('field_key, display_label, value_text, status, field_category, source_doc_id, updated_at')
      .eq('property_id', propertyId)
      .order('updated_at', { ascending: false })
      .limit(150),
    supabase
      .from('party_submissions')
      .select('role, name, status, doc_count, submitted_at')
      .eq('property_id', propertyId),
  ]);
  let { data: room } = roomResult;
  if (roomResult.error && /settlement_mode|settlement_readiness_pct|sealed_at|completed_at/i.test(roomResult.error.message || '')) {
    const legacyRoom = await supabase
      .from('deal_rooms')
      .select('property_name, deal_stage, closing_date, deal_type, deal_amount, workflow_pack_id, jurisdiction, metadata_values, checklist_items')
      .eq('property_id', propertyId)
      .maybeSingle();
    room = legacyRoom.data;
  }

  // Resolve packId: deal_type takes priority (same mapping as frontend resolvePackId),
  // then workflow_pack_id, then CRE default.
  const DEAL_TYPE_TO_PACK = {
    acquisition: DEFAULT_PACK_ID, refinance: DEFAULT_PACK_ID, construction: DEFAULT_PACK_ID,
    flag_conversion: DEFAULT_PACK_ID, sale: DEFAULT_PACK_ID, ground_lease: DEFAULT_PACK_ID,
    full_acquisition: 'business_acquisition', asset_purchase: 'business_acquisition',
    mbo: 'business_acquisition', merger: 'business_acquisition', business_acquisition: 'business_acquisition',
    seed: 'fundraising', series_a: 'fundraising', series_b_plus: 'fundraising',
    bridge: 'fundraising', fundraising: 'fundraising',
  };
  const inferredPack = room?.deal_type ? (DEAL_TYPE_TO_PACK[room.deal_type] ?? null) : null;
  // If deal_type inference resolves to the default CRE pack but workflow_pack_id says otherwise, trust workflow_pack_id
  const packId = (inferredPack && inferredPack !== DEFAULT_PACK_ID)
    ? inferredPack
    : (room?.workflow_pack_id || inferredPack || DEFAULT_PACK_ID);
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
  const checklist = Array.isArray(room?.checklist_items) ? room.checklist_items : [];
  const doneStatuses = new Set(['uploaded', 'approved', 'ai_complete']);
  const missingDocuments = checklist
    .filter(item => item.required && !doneStatuses.has(item.status) && !item.uploaded)
    .slice(0, 30)
    .map(item => ({
      label: item.label || item.name || item.id || 'Required document',
      section: item.section || item.category || null,
    }));
  const populatedRecordFields = (recordFields || [])
    .filter(field => {
      const value = String(field.value_text || '').trim().toLowerCase();
      return value && !['n/a', 'na', 'not applicable', 'not_applicable', 'unknown'].includes(value)
        && field.status !== 'not_applicable';
    })
    .slice(0, 100)
    .map(field => ({
      key: field.field_key,
      label: field.display_label || field.field_key,
      value: String(field.value_text).slice(0, 500),
      status: field.status || null,
      sourceDocId: field.source_doc_id || null,
    }));
  const documentFindings = (analyses || [])
    .map(item => {
      const analysis = item.analysis && typeof item.analysis === 'object' ? item.analysis : {};
      return {
        section: item.section || null,
        filename: item.filename || null,
        summary: String(analysis.summary || analysis.overview || analysis.text || '').slice(0, 1000),
        confidence: analysis.confidence ?? null,
        createdAt: item.created_at || null,
      };
    })
    .filter(item => item.summary || item.filename)
    .slice(0, 20);

  const participantContext = (participants || []).map(participant => ({
    role: participant.role || null,
    name: participant.name || null,
    status: participant.status || null,
    documentCount: Number(participant.doc_count || 0),
    submittedAt: participant.submitted_at || null,
  }));
  const recordStateFields = (recordFields || []).map(field => ({
    key: field.field_key,
    label: field.display_label || field.field_key,
    value: field.value_text || null,
    status: field.status || null,
    attention: field.status === 'source_changed' ? 'source_changed' : null,
  }));
  const digitalAssetEnabled = room?.metadata_values?.digital_asset_enabled === true
    || room?.metadata_values?.digital_asset_enabled === 'true'
    || room?.metadata_values?.digital_assets_enabled === true
    || room?.metadata_values?.digital_assets_enabled === 'true'
    || room?.metadata_values?.tokenization_enabled === true
    || room?.metadata_values?.tokenization_enabled === 'true'
    || room?.workflow_pack_id === 'tokenization'
    || room?.deal_type === 'tokenization';
  const transactionContext = {
    transaction: {
      propertyId,
      propertyName: room?.property_name || null,
      dealType: room?.deal_type || null,
      dealAmount: room?.deal_amount || null,
      workflowPack: packId,
      stage: room?.deal_stage || null,
      stageLabel,
      jurisdiction: room?.jurisdiction || null,
      digitalAssetEnabled,
      tokenizationOptional: true,
    },
    participants: participantContext,
    record: {
      facts: populatedRecordFields,
      factCount: populatedRecordFields.length,
      confirmedFactCount: populatedRecordFields.filter(field =>
        ['verified', 'source_changed'].includes(field.status)
      ).length,
      state: {
        schema: packId,
        fields: recordStateFields,
      },
    },
    evidence: {
      documents: documentFindings,
      missingDocuments,
    },
    operations: {
      openTasks: openTasks.map(describeTask),
      recentlyResolved: recentlyResolved.map(describeTask),
      chainStatus,
    },
    settlement: {
      mode: room?.settlement_mode || null,
      readinessPct: room?.settlement_readiness_pct == null
        ? null
        : Math.round(Number(room.settlement_readiness_pct) * 100),
      modeLocked: !!room?.settlement_mode_locked_at,
      sealedAt: room?.sealed_at || null,
      completedAt: room?.completed_at || null,
    },
  };

  return {
    packId,
    room: room
      ? {
          propertyName: room.property_name,
          stage: stageLabel,
          dealType: room.deal_type,
          dealAmount: room.deal_amount,
          closingDate: room.closing_date,
           jurisdiction: room.jurisdiction,
        }
      : null,
    openTasks: openTasks.map(describeTask),
    recentlyResolved: recentlyResolved.map(describeTask),
    missingDocuments,
    recordFacts: populatedRecordFields,
    documentFindings,
    chainStatus,
    transactionContext,
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
      transaction_context: ctx.transactionContext,
      deal: ctx.room,
      closing_chain: chainSummary,
      open_tasks: ctx.openTasks,
      recently_resolved_tasks: ctx.recentlyResolved,
      missing_documents: ctx.missingDocuments,
      transaction_record_facts: ctx.recordFacts,
      document_findings: ctx.documentFindings,
    },
    null,
    2
  );
}

const GROUNDING_RULES = `You are Kontra AI Copilot inside a specific transaction deal room (which may be CRE acquisition, business acquisition, or fundraising — follow the deal context provided).
You reason ONLY from the JSON context provided (transaction_context, closing_chain, open_tasks, recently_resolved_tasks, deal, missing_documents, transaction_record_facts, document_findings). Never invent
facts, people, dates, or documents not present in that context. If the context does not contain
enough information to answer, say so plainly instead of guessing.

Answer as a quiet transaction-workspace guide: explain findings, summarize what is missing, identify the next action, and give concise daily briefs when asked. Cite the specific task, document finding, record fact, or checklist item behind every claim.
This is AI-prepared operational guidance, not legal, regulatory, tax, investment, or settlement advice. Never claim that Kontra verified a legal or regulatory requirement, determined an exemption, approved an offering, or established eligibility. Use preparation, coordination, professional-review, and external-provider-handoff language instead.
Tokenization and digital-asset preparation are optional downstream paths. They never replace the transaction workflow and must not be presented as a default outcome.

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

${ctx.openTasks.length === 0 ? `IMPORTANT — ZERO OPEN TASKS: open_tasks is empty. There is nothing blocking this deal.
Status MUST be "on_track". The narrative must NOT use words like "pending", "blocking", "preventing", or "stalled".
Instead write 1-2 sentences that confirm the deal is progressing normally and name what the team is waiting on next (e.g. lender review, closing docs). Be brief and confident.` : ''}

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

    // Deterministic status override: if there are literally zero open tasks,
    // the deal cannot be "blocked" — pending chain steps without tasks just means
    // the step hasn't kicked off yet, which is normal deal flow.
    const deterministicStatus = ctx.openTasks.length === 0
      ? 'on_track'
      : criticalPathDetermined.length > 0
        ? (parsed.status || 'at_risk')
        : (parsed.status || 'on_track');
    const deterministicStatusLabel = ctx.openTasks.length === 0
      ? 'On Track'
      : criticalPathDetermined.length > 0
        ? (parsed.statusLabel || 'At Risk')
        : (parsed.statusLabel || 'On Track');

    const result = {
      status:          deterministicStatus,
      statusLabel:     deterministicStatusLabel,
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
      missingDocuments: ctx.missingDocuments,
      recordFactCount: ctx.recordFacts.length,
      documentFindingCount: ctx.documentFindings.length,
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
  const narrative = ctx.openTasks.length === 0
    ? 'No open tasks — the deal room is progressing normally.'
    : activeStep && activeStep.openCount > 0
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
    missingDocuments: ctx.missingDocuments,
    recordFactCount: ctx.recordFacts.length,
    documentFindingCount: ctx.documentFindings.length,
  };
}

// ── Answer engine ─────────────────────────────────────────────────────────────
async function askQuestion(propertyId, question) {
  if (!question || !question.trim()) {
    return { answer: 'Ask a question about this workspace — e.g. "What\'s blocking closing?" or "What should happen next?"', citedTaskIds: [] };
  }
  const ctx = await buildGroundedContext(propertyId);
  const openai = getOpenAI();
  const tokenizationGuidance = isTokenizationQuestion(question)
    ? buildTokenizationGuidance({ transactionContext: ctx.transactionContext })
    : null;

  if (!openai) {
    if (tokenizationGuidance) {
      const gaps = tokenizationGuidance.gaps.slice(0, 4)
        .map(item => item.label)
        .join(', ');
      return {
        answer: `${buildTokenizationAnswerPrefix(tokenizationGuidance)}${gaps ? ` Next coordination focus: ${gaps}.` : ''}`,
        citedTaskIds: ctx.openTasks.map(t => t.id),
      };
    }
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
If the question cannot be answered from context, say so directly.
${tokenizationGuidance ? `\n${buildTokenizationPrompt(tokenizationGuidance)}` : ''}`,
        },
        { role: 'user', content: `Workspace context:\n${contextToPrompt(ctx)}\n\nQuestion: ${question}` },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content || '{}');
    const aiAnswer = parsed.answer || 'I could not generate an answer from the current workspace data.';
    return {
      answer: tokenizationGuidance
        ? `${buildTokenizationAnswerPrefix(tokenizationGuidance)}\n\n${aiAnswer}`
        : aiAnswer,
      citedTaskIds: Array.isArray(parsed.citedTaskIds) ? parsed.citedTaskIds : [],
    };
  } catch (err) {
    console.error('[operationsManager] askQuestion LLM error:', err.message);
    return {
      answer: tokenizationGuidance
        ? `${buildTokenizationAnswerPrefix(tokenizationGuidance)}\n\nAI explanation is temporarily unavailable; use the recorded facts and preparation gaps above.`
        : 'Something went wrong answering that question. Please try again.',
      citedTaskIds: [],
    };
  }
}

// ── Daily standup (evening wrap-up) ───────────────────────────────────────────
const standupCache = new Map();

function getCachedStandup(propertyId) {
  const entry = standupCache.get(propertyId);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  standupCache.delete(propertyId);
  return null;
}

function setCachedStandup(propertyId, data) {
  standupCache.set(propertyId, { data, expiresAt: Date.now() + BRIEFING_TTL_MS });
}

function describeStandupTask(ctx, t) {
  return {
    id: t.id,
    title: t.title,
    ownedBy: t.owner_type === 'ai' ? 'AI' : getPackRoleLabel(ctx.packId, t.owner_role || 'unknown'),
    status: t.status,
  };
}

function buildFallbackStandup(ctx, completedToday, stillBlocked) {
  const narrative = completedToday.length
    ? `${completedToday.length} item${completedToday.length === 1 ? '' : 's'} completed today.` +
      (stillBlocked.length
        ? ` ${stillBlocked.length} item${stillBlocked.length === 1 ? '' : 's'} still ${stillBlocked.length === 1 ? 'is' : 'are'} open.`
        : ' Nothing else is blocking closing.')
    : stillBlocked.length
      ? `No items were completed today. ${stillBlocked.length} item${stillBlocked.length === 1 ? '' : 's'} remain open.`
      : 'No activity today. Nothing is blocking closing.';

  return {
    date: new Date().toISOString().slice(0, 10),
    narrative,
    tomorrowPlan: stillBlocked.slice(0, 3).map(t => `Follow up on: ${t.title}`),
    risks: [],
    completedToday,
    stillBlocked,
    completedCount: completedToday.length,
    blockedCount: stillBlocked.length,
  };
}

async function getStandup(propertyId) {
  const cached = getCachedStandup(propertyId);
  if (cached) return cached;

  const { listTasksForRoom: listTasks } = require('./taskEngine');
  const [ctx, allTasks] = await Promise.all([
    buildGroundedContext(propertyId),
    listTasks(propertyId),
  ]);

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const completedToday = allTasks
    .filter(t => ['completed', 'dismissed'].includes(t.status) && t.updated_at && new Date(t.updated_at) >= startOfToday)
    .map(t => describeStandupTask(ctx, t));

  const stillBlocked = (ctx.chainStatus?.activeStep?.openTasks || []).map(t => describeStandupTask(ctx, t));

  const fallback = () => {
    const result = buildFallbackStandup(ctx, completedToday, stillBlocked);
    setCachedStandup(propertyId, result);
    return result;
  };

  const openai = getOpenAI();
  if (!openai) return fallback();

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${GROUNDING_RULES}

This is an END-OF-DAY STANDUP, not the morning briefing. "Completed today" and "still blocked" have
already been computed deterministically from real task data — do not restate them as lists, just
reason about them narratively.

Respond as JSON:
{
  "narrative": string (2-3 sentences max. What moved today, and what's still open. Be specific about
    the active chain step if something is blocked. If nothing happened today, say so plainly.),
  "tomorrowPlan": [string] (1-3 short, concrete next steps for tomorrow, grounded only in open_tasks
    and closing_chain — never invent new tasks),
  "risks": [string] (0-2 short items naming anything at real risk of slipping, e.g. a task that has
    been open a long time relative to the closing date. Return [] if nothing is clearly at risk.)
}`,
        },
        {
          role: 'user',
          content: `${contextToPrompt(ctx)}\n\nCompleted today: ${JSON.stringify(completedToday)}`,
        },
      ],
    });
    const parsed = JSON.parse(resp.choices[0].message.content || '{}');

    const result = {
      date: new Date().toISOString().slice(0, 10),
      narrative: parsed.narrative || null,
      tomorrowPlan: Array.isArray(parsed.tomorrowPlan) ? parsed.tomorrowPlan : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      completedToday,
      stillBlocked,
      completedCount: completedToday.length,
      blockedCount: stillBlocked.length,
    };
    setCachedStandup(propertyId, result);
    return result;
  } catch (err) {
    console.error('[operationsManager] getStandup LLM error:', err.message);
    return fallback();
  }
}

function clearCache(propertyId) {
  briefingCache.delete(propertyId);
  standupCache.delete(propertyId);
}

module.exports = {
  buildGroundedContext,
  getBriefing,
  getStandup,
  askQuestion,
  clearCache,
};
