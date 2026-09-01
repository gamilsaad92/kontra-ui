// operationsManager.js — the "Operations Manager" answer engine.
//
// Product principle: this is an answer engine grounded strictly in the Task
// Engine's rows (deal_room_tasks) plus deal_room evidence. It can answer any
// operational question about a workspace. It never fabricates facts.
const { supabase } = require('../db');
const {
  DEFAULT_PACK_ID,
  getPackRoleConfig,
  getPackRoleLabel,
  getPackStageConfig,
  getPackStageLabel,
} = require('./dealRoomHelpers');
const { listTasksForRoom } = require('./taskEngine');
const { readTransactionState } = require('./transactionState');
const { selectActiveDocumentVersions } = require('./documentVersions');
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

function clearBriefingCache(propertyId) {
  if (propertyId) briefingCache.delete(propertyId);
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

function hasOpenTaskStatus(task) {
  return ['pending', 'in_progress', 'escalated'].includes(String(task?.status || '').toLowerCase());
}

function taskEvidence(task) {
  if (Array.isArray(task?.evidence)) return task.evidence.filter(Boolean);
  if (typeof task?.evidence === 'string') {
    try {
      const parsed = JSON.parse(task.evidence);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return task.evidence.trim() ? [task.evidence.trim()] : [];
    }
  }
  return [];
}

function buildPackLifecycle(packId, stageKey, generatedProposal = null) {
  if (generatedProposal?.stages?.length) {
    const stages = generatedProposal.stages.map(stage => ({ key: stage.key, label: stage.name }));
    const current = stages.find(stage => stage.key === stageKey) || null;
    return {
      source: 'approved_generated_proposal',
      packId,
      currentStageKey: stageKey || null,
      currentStageLabel: current?.label || null,
      stages,
    };
  }
  const stageConfig = getPackStageConfig(packId) || {};
  const stages = Array.isArray(stageConfig.stages) ? stageConfig.stages : [];
  const current = stages.find(stage => stage.key === stageKey) || null;

  return {
    source: 'resolved_workflow_pack_and_room_stage',
    packId,
    currentStageKey: stageKey || null,
    currentStageLabel: current?.label || (stageKey ? getPackStageLabel(packId, stageKey) : null),
    stages: stages.map(stage => ({ key: stage.key, label: stage.label })),
  };
}

const ACTIVE_PARTICIPANT_INVITE_STATUSES = new Set([
  'pending', 'invited', 'sent', 'accepted', 'joined', 'active',
]);
const JOINED_PARTICIPANT_INVITE_STATUSES = new Set(['accepted', 'joined', 'active']);

function isCoordinatorRoleDefinition(role) {
  return role?.invitable === false || role?.canManage === true;
}

function normalizeParticipantDefinitions(roles) {
  return (Array.isArray(roles) ? roles : [])
    .filter(role => role && role.key)
    .map(role => ({
      key: role.key,
      label: role.label || role.shortLabel || role.key,
      required: role.required !== false,
      invitable: role.invitable !== false,
      canManage: role.canManage === true,
      legacyOnly: role.legacyOnly === true,
    }));
}

async function loadLiveParticipantDefinitions(room, packId) {
  if (Array.isArray(room?.workflow_pack_config?.roles)) {
    return normalizeParticipantDefinitions(room.workflow_pack_config.roles);
  }

  if (String(packId || '').startsWith('ws_')) {
    try {
      const { data, error } = await supabase
        .from('custom_workflow_packs')
        .select('config')
        .eq('id', packId)
        .maybeSingle();
      if (error) throw error;
      return normalizeParticipantDefinitions(data?.config?.roles);
    } catch (error) {
      // A custom room must never fall back to the built-in CRE roles. If its
      // live pack cannot be read, omit participant blockers rather than invent
      // requirements from a different template.
      console.warn('[operationsManager] live participant configuration unavailable:', error.message);
      return [];
    }
  }

  // Generated AI rooms without a persisted custom pack keep their approved
  // People configuration in the room proposal. This is room state, not the
  // generic built-in role registry.
  const proposal = room?.generated_proposal || room?.metadata_values?.generated_proposal;
  if (packId === 'generated_ai' && Array.isArray(proposal?.participants)) {
    return normalizeParticipantDefinitions(proposal.participants.map(participant => ({
      ...participant,
      key: participant.role || participant.key,
    })));
  }

  return normalizeParticipantDefinitions(getPackRoleConfig(packId)?.roles);
}

function hasMeaningfulRecordValue(field) {
  const value = field?.value ?? field?.value_text ?? field?.value_json;
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

function isParticipantTask(task) {
  return task?.task_type === 'missing_participant'
    || task?.task_type === 'pending_submission'
    || task?.source_type === 'party_role'
    || task?.source_type === 'party_submission';
}

function filterTasksToLiveParticipants(tasks, participantDefinitions) {
  const liveParticipantKeys = new Set((participantDefinitions || []).map(role => role.key));
  return (Array.isArray(tasks) ? tasks : []).filter(task =>
    !isParticipantTask(task) || liveParticipantKeys.has(subjectRoleOf(task))
  );
}

function buildGroundedBlockers({
  packId, recordState, missingDocuments, participants, tasks, participantDefinitions, conflicts = [],
}) {
  const blockers = [];
  const requiredFields = Array.isArray(recordState?.requiredFields) ? recordState.requiredFields : [];
  const participantRows = Array.isArray(participants) ? participants : [];
  const openTasks = Array.isArray(tasks) ? tasks.filter(hasOpenTaskStatus) : [];
  const effectiveParticipantDefinitions = participantDefinitions !== undefined
    ? participantDefinitions
    : String(packId || '').startsWith('ws_')
      ? []
      : (getPackRoleConfig(packId)?.roles || []);
  const liveRequiredParticipantKeys = new Set(effectiveParticipantDefinitions
    .filter(role => role.required && role.invitable !== false
      && !role.legacyOnly && !isCoordinatorRoleDefinition(role))
    .map(role => role.key));

  (Array.isArray(conflicts) ? conflicts : []).forEach(conflict => {
    const fieldKey = conflict.fieldKey || conflict.field_key || '';
    const label = conflict.label || conflict.display_label || fieldKey || 'Transaction Record field';
    const title = /repair\s*cost/i.test(`${label} ${fieldKey}`)
      ? 'Resolve Repair Cost Discrepancy'
      : `Resolve ${label} Discrepancy`;
    blockers.push({
      sourceType: 'transaction_record_conflict',
      conflictId: conflict.id || null,
      key: fieldKey || null,
      label: title,
      status: 'unresolved',
      evidence: [
        `${label} has conflicting values: ${conflict.canonicalValue ?? conflict.canonical_value ?? 'not recorded'} and ${conflict.conflictingValue ?? conflict.conflicting_value ?? 'not recorded'}.`,
        ...(conflict.canonicalSourceDocId || conflict.canonical_source_doc_id
          ? [`Canonical source document: ${conflict.canonicalSourceDocId || conflict.canonical_source_doc_id}.`] : []),
        ...(conflict.conflictingSourceDocId || conflict.conflicting_source_doc_id
          ? [`Conflicting source document: ${conflict.conflictingSourceDocId || conflict.conflicting_source_doc_id}.`] : []),
      ],
    });
  });

  (Array.isArray(missingDocuments) ? missingDocuments : []).forEach(document => {
    blockers.push({
      sourceType: 'required_document',
      label: document.label,
      section: document.section || null,
      evidence: [`Required checklist item "${document.label}" is not complete.`],
    });
  });

  effectiveParticipantDefinitions
    .filter(role => role.required && role.invitable !== false
      && !role.legacyOnly && !isCoordinatorRoleDefinition(role))
    .forEach(role => {
      const participant = participantRows.find(row => row.role === role.key);
      const participantStatus = String(participant?.status || '').toLowerCase();
      const inviteStatus = String(participant?.inviteStatus || '').toLowerCase();
      const submitted = JOINED_PARTICIPANT_INVITE_STATUSES.has(inviteStatus)
        || ['submitted', 'complete', 'completed'].includes(participantStatus)
        || Number(participant?.documentCount || participant?.doc_count || 0) > 0;
      if (submitted) return;

      const roleLabel = role.label || getPackRoleLabel(packId, role.key);
      blockers.push({
        sourceType: 'required_participant',
        role: role.key,
        label: roleLabel,
        status: participant?.status || 'missing',
        evidence: [
          participant
            ? `${roleLabel} status is "${participant.status || participant.inviteStatus || 'unknown'}" with ${Number(participant.documentCount || participant.doc_count || 0)} submitted document(s).`
            : `No participant submission exists for required role "${role.key}".`,
        ],
      });
    });

  requiredFields
    .filter(field => {
      const status = String(field.status || '').toLowerCase();
      const populated = hasMeaningfulRecordValue(field);
      return field.attention === 'source_changed'
        || status === 'conflict'
        || status === 'missing'
        || (!populated && status === 'awaiting');
    })
    .forEach(field => {
      const status = String(field.status || '').toLowerCase();
      blockers.push({
        sourceType: 'transaction_record',
        key: field.key,
        label: field.label || field.key,
        status,
        attention: field.attention || null,
        evidence: [
          field.attention === 'source_changed'
            ? `${field.label || field.key} changed source and requires coordinator review.`
            : `${field.label || field.key} is ${status === 'missing' ? 'missing' : 'incomplete'}.`,
        ],
      });
    });

  openTasks
    .filter(task => (task.blocking === true || task.blocking === 'true') && taskEvidence(task).length > 0)
    .filter(task => {
      const participantTask = task.task_type === 'missing_participant'
        || task.task_type === 'pending_submission'
        || task.source_type === 'party_role'
        || task.source_type === 'party_submission';
      if (!participantTask) return true;
      return liveRequiredParticipantKeys.has(subjectRoleOf(task));
    })
    .forEach(task => {
      blockers.push({
        sourceType: 'explicit_blocking_task',
        taskId: task.id,
        label: task.title,
        status: task.status,
        evidence: taskEvidence(task),
      });
    });

  return blockers;
}

// The grounding path must tolerate rooms created before document-version
// columns were added. The public analyses endpoint has the same compatibility
// requirement; never treat a schema mismatch as an empty live evidence set.
async function loadGroundingAnalyses(propertyId) {
  const selects = [
    'id, section, filename, analysis, created_at, processing_status, is_active, superseded_at',
    'id, section, filename, analysis, created_at, processing_status',
    'id, section, filename, analysis, created_at',
  ];
  let lastError = null;

  for (const select of selects) {
    const result = await supabase
      .from('deal_analyses')
      .select(select)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (!result.error) return result.data || [];
    lastError = result.error;
    if (!/column|schema cache|does not exist|could not find/i.test(result.error.message || '')) break;
  }

  if (lastError) {
    console.warn('[operationsManager] could not load document evidence:', lastError.message);
  }
  return [];
}

// ── Grounding context ─────────────────────────────────────────────────────────
async function buildGroundedContext(propertyId) {
  const [transactionState, tasks, analyses, { data: participants }, { data: participantInvites }] = await Promise.all([
    readTransactionState(propertyId),
    listTasksForRoom(propertyId),
    loadGroundingAnalyses(propertyId),
    supabase
      .from('party_submissions')
      .select('role, name, status, doc_count, submitted_at')
      .eq('property_id', propertyId),
    supabase
      .from('deal_room_invites')
      .select('role_key, status, expires_at, revoked_at')
      .eq('property_id', propertyId),
  ]);
  const activeAnalyses = selectActiveDocumentVersions(analyses);
  const room = transactionState.room;
  const packId = transactionState.packId || DEFAULT_PACK_ID;
  const generatedProposal = room?.generated_proposal
    || room?.metadata_values?.generated_proposal
    || null;
  const generatedTransaction = generatedProposal?.transaction || {};
  const recordState = transactionState.recordState;
  const conflicts = transactionState.conflicts || recordState.unresolvedConflicts || [];
  const generatedStage = generatedProposal?.stages?.find(stage => stage.key === room?.deal_stage);
  const stageLabel = generatedStage?.name
    || (room?.deal_stage ? getPackStageLabel(packId, room.deal_stage) : null);

  const allOpenTasks = tasks.filter(t => ['pending', 'in_progress', 'escalated'].includes(t.status));
  const allRecentlyResolved = tasks
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

  const checklist = Array.isArray(room?.checklist_items) ? room.checklist_items : [];
  const missingDocuments = getLiveMissingDocuments(checklist, activeAnalyses);
  const populatedRecordFields = (recordState.fields || [])
    .filter(field => field.value !== null && field.value !== undefined
      && String(field.value).trim()
      && field.status !== 'not_applicable')
    .slice(0, 100)
    .map(field => ({
      key: field.key,
      label: field.label || field.key,
      value: String(field.value).slice(0, 500),
      status: field.status,
      rawStatus: field.rawStatus,
      attention: field.attention,
      required: field.required,
    }));
  const documentFindings = activeAnalyses
    .map(item => {
      const analysis = item.analysis && typeof item.analysis === 'object' ? item.analysis : {};
      return {
        id: item.id || null,
        section: item.section || null,
        filename: item.filename || null,
        summary: String(analysis.summary || analysis.overview || analysis.text || '').slice(0, 1000),
        confidence: analysis.confidence ?? null,
        processingStatus: item.processing_status || (analysis.pending === true ? 'processing' : 'complete'),
        active: true,
        createdAt: item.created_at || null,
      };
    })
    .filter(item => item.summary || item.filename)
    .slice(0, 20);

  const participantDefinitions = await loadLiveParticipantDefinitions(room, packId);
  const liveParticipantKeys = new Set(participantDefinitions.map(role => role.key));
  const liveInvites = (participantInvites || []).filter(invite => {
    const status = String(invite?.status || '').toLowerCase();
    if (!ACTIVE_PARTICIPANT_INVITE_STATUSES.has(status)) return false;
    if (['pending', 'invited', 'sent'].includes(status)
      && invite?.expires_at
      && new Date(invite.expires_at).getTime() <= Date.now()) return false;
    return liveParticipantKeys.has(invite.role_key);
  });
  const participantContext = participantDefinitions
    .filter(role => role.invitable !== false && !role.legacyOnly)
    .map(role => {
      const submission = (participants || []).find(item =>
        item?.role === role.key
      );
      const invite = liveInvites.find(item => item.role_key === role.key);
      return {
        role: role.key,
        name: submission?.name || null,
        status: submission?.status || invite?.status || null,
        inviteStatus: invite?.status || null,
        invited: !!invite,
        documentCount: Number(submission?.doc_count || 0),
        submittedAt: submission?.submitted_at || null,
      };
    });
  const groundedTasks = filterTasksToLiveParticipants(tasks, participantDefinitions);
  const openTasks = allOpenTasks.filter(task => groundedTasks.includes(task));
  const recentlyResolved = allRecentlyResolved.filter(task => groundedTasks.includes(task));
  const chainStatus = computeChainStatus(packId, groundedTasks.map(t => ({ ...t, ownerRole: t.owner_role })));
  const recordStateFields = recordState.fields || [];
  const meaningfulRecordField = key => recordStateFields.find(field =>
    field.key === key
      && field.value !== null
      && field.value !== undefined
      && String(field.value).trim()
      && field.status !== 'not_applicable'
  );
  const transactionTypeField = meaningfulRecordField('transaction.type');
  const closingDateField = meaningfulRecordField('transaction.closing_date');
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
       transactionType: transactionTypeField?.value || room?.transaction_type || room?.deal_type || packId,
       transactionSubtype: room?.transaction_subtype || generatedTransaction.subtype || null,
       basePack: room?.base_pack || packId,
       contextFacts: generatedTransaction.context_facts || room?.transaction_context || [],
       unresolvedQuestions: generatedProposal?.issues_to_confirm || [],
       requirementProvenance: generatedProposal?.requirements || [],
      dealAmount: room?.deal_amount || null,
      workflowPack: packId,
      stage: room?.deal_stage || null,
      stageLabel,
      closingDate: room?.closing_date || closingDateField?.value || null,
      jurisdiction: room?.jurisdiction || null,
      digitalAssetEnabled,
      tokenizationOptional: true,
    },
    participants: participantContext,
    record: {
      facts: populatedRecordFields,
      factCount: populatedRecordFields.length,
      confirmedFactCount: recordStateFields.filter(field => field.status === 'confirmed').length,
      awaitingConfirmation: populatedRecordFields
        .filter(field => field.status === 'awaiting')
        .map(field => ({
          key: field.key,
          label: field.label,
          value: field.value,
          status: 'awaiting_confirmation',
        })),
      awaitingConfirmationCount: populatedRecordFields
        .filter(field => field.status === 'awaiting').length,
      state: {
        schema: recordState.schemaKey,
        fields: recordStateFields,
        requiredCount: recordState.requiredCount,
        confirmedCount: recordState.confirmedCount,
        awaitingRequiredCount: recordState.awaitingRequiredCount,
        conflictRequiredCount: recordState.conflictRequiredCount,
        unresolvedConflictCount: recordState.unresolvedConflictCount || 0,
        notApplicableCount: recordState.notApplicableCount,
      },
    },
    evidence: {
      documents: documentFindings,
      activeDocumentState: {
        count: activeAnalyses.length,
        documents: activeAnalyses.map(item => ({
          id: item.id || null,
          section: item.section || null,
          filename: item.filename || null,
          processingStatus: item.processing_status || (item.analysis?.pending === true ? 'processing' : 'complete'),
        })),
        missingRequirements: missingDocuments,
      },
      missingDocuments,
      conflicts,
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
    conflicts,
    recordFacts: populatedRecordFields,
    documentFindings,
    chainStatus,
     lifecycle: buildPackLifecycle(packId, room?.deal_stage || null, generatedProposal),
    groundedBlockers: buildGroundedBlockers({
      packId,
      recordState,
      missingDocuments,
      participants: participantContext,
      tasks,
      participantDefinitions,
      conflicts,
    }),
    transactionContext,
    recordState,
    readiness: transactionState.readiness,
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
      active_document_state: ctx.transactionContext.evidence.activeDocumentState,
      transaction_record_facts: ctx.recordFacts,
      transaction_record_review: ctx.transactionContext.record.awaitingConfirmation,
      document_findings: ctx.documentFindings,
      transaction_record_conflicts: ctx.conflicts,
    },
    null,
    2
  );
}

function askContextToPrompt(ctx) {
  const blockerTaskIds = new Set(
    (ctx.groundedBlockers || [])
      .map(blocker => blocker.taskId)
      .filter(Boolean)
  );

  return JSON.stringify(
    {
      transaction_context: ctx.transactionContext,
      lifecycle: ctx.lifecycle,
      blockers: ctx.groundedBlockers,
      non_blocking_open_tasks: ctx.openTasks
        .filter(task => !blockerTaskIds.has(task.id))
        .map(task => ({
          id: task.id,
          title: task.title,
          status: task.status,
          ownerRole: task.ownerRole,
          evidence: task.evidence,
        })),
      recently_resolved_tasks: ctx.recentlyResolved,
      missing_documents: ctx.missingDocuments,
      active_document_state: ctx.transactionContext.evidence.activeDocumentState,
      transaction_record_facts: ctx.recordFacts,
      transaction_record_review: ctx.transactionContext.record.awaitingConfirmation,
      document_findings: ctx.documentFindings,
      transaction_record_conflicts: ctx.conflicts,
    },
    null,
    2
  );
}

// A checklist row describes a requirement, while deal_analyses describes the
// evidence that has actually arrived. A requirement is not missing merely
// because its latest analysis is still being processed.
const DOCUMENT_RECEIVED_STATUSES = new Set([
  'uploaded', 'processing', 'retrying', 'analyzing', 'analyzed',
  'complete', 'completed', 'approved', 'ai_complete', 'received',
]);

function normalizedDocumentText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function documentRequirementMatchesAnalysis(requirement, analysis) {
  const requirementSection = normalizedDocumentText(requirement?.section || requirement?.category);
  const analysisSection = normalizedDocumentText(analysis?.section);
  if (requirementSection && analysisSection && requirementSection === analysisSection) return true;

  const requirementLabels = [
    requirement?.label,
    requirement?.name,
    requirement?.document_type,
    requirement?.documentType,
  ].map(normalizedDocumentText).filter(Boolean);
  const analysisLabels = [
    analysis?.filename,
    analysis?.document_type,
    analysis?.documentType,
    analysis?.analysis?.document_type,
    analysis?.analysis?.documentType,
    analysis?.analysis?.title,
  ].map(normalizedDocumentText).filter(Boolean);
  return requirementLabels.some(label =>
    analysisLabels.some(candidate =>
      label === candidate
        || (label.length > 2 && candidate.includes(label))
        || (candidate.length > 2 && label.includes(candidate)),
    )
  );
}

function isDocumentRequirementReceived(requirement, activeAnalyses = []) {
  const status = String(requirement?.status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['not_applicable', 'na', 'n_a'].includes(status)) return false;
  if (requirement?.uploaded === true || requirement?.uploaded === 'true') return true;
  if (DOCUMENT_RECEIVED_STATUSES.has(status)) return true;
  return activeAnalyses.some(analysis =>
    analysis
      && analysis.is_active !== false
      && !analysis.superseded_at
      && documentRequirementMatchesAnalysis(requirement, analysis)
  );
}

function getLiveMissingDocuments(checklist = [], activeAnalyses = []) {
  return (Array.isArray(checklist) ? checklist : [])
    .filter(item => item?.required && !isDocumentRequirementReceived(item, activeAnalyses))
    .slice(0, 30)
    .map(item => ({
      id: item.id || item.document_id || item.documentId || null,
      label: item.label || item.name || item.id || 'Required document',
      section: item.section || item.category || null,
    }));
}

const GROUNDING_RULES = `You are Kontra AI Copilot inside a specific transaction deal room (which may be CRE acquisition, business acquisition, or fundraising — follow the deal context provided).
You reason ONLY from the JSON context provided (transaction_context, closing_chain, open_tasks, recently_resolved_tasks, deal, missing_documents, active_document_state, transaction_record_facts, document_findings). Never invent
facts, people, dates, or documents not present in that context. If the context does not contain
enough information to answer, say so plainly instead of guessing.
Treat active_document_state as the source of truth for document receipt: an active uploaded,
processing, retrying, or completed document has been received and must not be described as missing.
Only list a document as missing when it appears in missing_documents.
The participants array is the live People state for this room. Do not import roles from a
generic template or from outside this room. A populated Transaction Record field with status
"awaiting_confirmation" is a known fact awaiting coordinator confirmation, not a missing or
incomplete field; do not describe it as awaiting completion.

Answer as a quiet transaction-workspace guide: explain findings, summarize what is missing, identify the next action, and give concise daily briefs when asked. Cite the specific task, document finding, record fact, or checklist item behind every claim.
This is AI-prepared operational guidance, not legal, regulatory, tax, investment, or settlement advice. Never claim that Kontra verified a legal or regulatory requirement, determined an exemption, approved an offering, or established eligibility. Use preparation, coordination, professional-review, and external-provider-handoff language instead.
Tokenization and digital-asset preparation are optional downstream paths. They never replace the transaction workflow and must not be presented as a default outcome.

DEPENDENCY CHAIN REASONING: The closing_chain shows sequential steps where each step gates the next.
The earliest step that is NOT "complete" is the ACTIVE BLOCKER — tasks in that step are on the critical path.
Tasks in later steps are blocked and cannot progress until the active step clears.
Tasks in parallel tracks are open but do NOT gate the chain steps.

CRITICAL PATH DISCIPLINE: most open tasks do not block closing. Only tasks in the earliest incomplete
chain step are truly on the critical path. Everything else is background noise. Always name the owner.`;

const ASK_GROUNDING_RULES = `You are Kontra AI inside one specific transaction deal room.
Reason ONLY from the JSON context provided. Never invent facts, stages, blockers, people, dates,
documents, or requirements from general CRE, lending, legal, or financial knowledge.

LIFECYCLE RULE: The lifecycle object is the only source for current stage and stage order. Use its
resolved Workflow Pack and room stage exactly. Never substitute a generic lending or CRE lifecycle.

BLOCKER RULE: The blockers array is the complete factual blocker list. It contains only required
document gaps, required participant state, canonical required Transaction Record gaps/conflicts,
and explicit blocking tasks with evidence. A non_blocking_open_tasks item is not a blocker. If the
blockers array is empty, say that no blocker is recorded instead of inferring one.
The transaction_context.participants array is the live People state for this room. Never add
Buyer, Seller, Legal Advisor, Financial Advisor, or any other role unless it is present there.
The transaction_record_review array contains populated facts awaiting coordinator confirmation;
these are not missing or incomplete and must not be described as awaiting completion.

TOKENIZATION RULE: Digital-asset preparation is optional and downstream. Use the transaction_context
facts first, then tokenization-specific guidance if supplied. Already-known transaction type, pack,
stage, and closing date must not be described as missing. Separate core transaction gaps from
optional digital-asset preparation gaps.

This is coordination and preparation guidance, not legal, regulatory, investment, settlement,
issuance, custody, or eligibility advice. Keep every factual statement tied to a provided source.`;

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
  const conflictPathDetermined = (ctx.conflicts || []).map(conflict => ({
    taskId: `transaction-conflict-${conflict.id || conflict.fieldKey}`,
    owner: 'Deal Coordinator',
    item: /repair\s*cost/i.test(`${conflict.label || ''} ${conflict.fieldKey || ''}`)
      ? 'Resolve Repair Cost Discrepancy'
      : `Resolve ${conflict.label || conflict.fieldKey || 'Transaction Record'} Discrepancy`,
    note: `Canonical value ${conflict.canonicalValue || 'not recorded'} conflicts with ${conflict.conflictingValue || 'another source'}.`,
    chainStep: activeStep?.step || null,
  }));
  const allCriticalPath = [...conflictPathDetermined, ...criticalPathDetermined];

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
    const deterministicStatus = (ctx.conflicts || []).length > 0
      ? 'blocked'
      : ctx.openTasks.length === 0
      ? 'on_track'
      : criticalPathDetermined.length > 0
        ? (parsed.status || 'at_risk')
        : (parsed.status || 'on_track');
    const deterministicStatusLabel = (ctx.conflicts || []).length > 0
      ? 'Blocked'
      : ctx.openTasks.length === 0
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
      criticalPath:    allCriticalPath,
      blocking:        allCriticalPath,
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
  const narrative = (ctx.conflicts || []).length
    ? 'A material Transaction Record discrepancy needs coordinator resolution before approval or fund release.'
    : ctx.openTasks.length === 0
      ? 'No open tasks — the deal room is progressing normally.'
      : activeStep && activeStep.openCount > 0
        ? `Step ${activeStep.step}: ${activeStep.label} is the active blocker — ${activeStep.openCount} task(s) need resolution before the next step can begin.`
        : criticalPath.length
          ? 'AI reasoning is temporarily unavailable — showing a plain readout of open tasks.'
          : 'All tasks are resolved. The transaction is on track.';

  return {
    status: (ctx.conflicts || []).length ? 'blocked' : (criticalPath.length ? 'at_risk' : 'on_track'),
    statusLabel: (ctx.conflicts || []).length ? 'Blocked' : (criticalPath.length ? 'At Risk' : 'On Track'),
    expectedClosing: ctx.room?.closingDate || null,
    criticalPath: [
      ...(ctx.conflicts || []).map(conflict => ({
        taskId: `transaction-conflict-${conflict.id || conflict.fieldKey}`,
        owner: 'Deal Coordinator',
        item: /repair\s*cost/i.test(`${conflict.label || ''} ${conflict.fieldKey || ''}`)
          ? 'Resolve Repair Cost Discrepancy'
          : `Resolve ${conflict.label || conflict.fieldKey || 'Transaction Record'} Discrepancy`,
        note: `Canonical value ${conflict.canonicalValue || 'not recorded'} conflicts with ${conflict.conflictingValue || 'another source'}.`,
      })),
      ...criticalPath,
    ],
    blocking: [
      ...(ctx.conflicts || []).map(conflict => ({
        taskId: `transaction-conflict-${conflict.id || conflict.fieldKey}`,
        owner: 'Deal Coordinator',
        item: /repair\s*cost/i.test(`${conflict.label || ''} ${conflict.fieldKey || ''}`)
          ? 'Resolve Repair Cost Discrepancy'
          : `Resolve ${conflict.label || conflict.fieldKey || 'Transaction Record'} Discrepancy`,
        note: `Canonical value ${conflict.canonicalValue || 'not recorded'} conflicts with ${conflict.conflictingValue || 'another source'}.`,
      })),
      ...criticalPath,
    ],
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
    ? buildTokenizationGuidance({
      transactionContext: ctx.transactionContext,
      recordState: ctx.recordState,
    })
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
          content: `${ASK_GROUNDING_RULES}

Answer the user's operational question. Respond as JSON:
{ "answer": string (direct answer — 1-4 sentences. Use lifecycle and blockers only for transaction-specific
  claims. If blockers are present, name the source and evidence. If only non-blocking tasks are open,
  say they are follow-up work rather than blockers.),
  "citedTaskIds": [ string ] }
If the question cannot be answered from context, say so directly.
${tokenizationGuidance ? `\n${buildTokenizationPrompt(tokenizationGuidance)}` : ''}`,
        },
        { role: 'user', content: `Workspace context:\n${askContextToPrompt(ctx)}\n\nQuestion: ${question}` },
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
  clearBriefingCache(propertyId);
  standupCache.delete(propertyId);
}

module.exports = {
  buildGroundedContext,
  buildPackLifecycle,
  buildGroundedBlockers,
  getLiveMissingDocuments,
  isDocumentRequirementReceived,
  askContextToPrompt,
  getBriefing,
  clearBriefingCache,
  getStandup,
  askQuestion,
  clearCache,
};
