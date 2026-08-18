'use strict';

const crypto = require('crypto');
const { supabase } = require('../db');
const { getRoomPackId, logEvent } = require('./dealRoomHelpers');
const { emit } = require('./eventBus');
const {
  listTasksForRoom,
  evaluateDealRoomForTasks,
  evaluateReadinessTasks,
} = require('./taskEngine');
const {
  canonicalizeTransactionRecordKey,
} = require('./transactionRecordCanonicalization');
const {
  buildTokenizationGuidance,
} = require('./tokenizationGuidance');

let requirements = null;
function getRequirements() {
  if (!requirements) {
    requirements = require('../../shared/transaction_record_requirements.json');
  }
  return requirements;
}

async function resolveSchemaKey(room) {
  const allRequirements = getRequirements();
  let schemaKey = room?.workflow_pack_id || room?.deal_type || 'generic';
  if (!allRequirements[schemaKey] && String(schemaKey).startsWith('ws_')) {
    try {
      const { data } = await supabase
        .from('custom_workflow_packs')
        .select('config')
        .eq('id', schemaKey)
        .maybeSingle();
      const transactionType = data?.config?.transactionType;
      if (allRequirements[transactionType]) schemaKey = transactionType;
    } catch (error) {
      console.warn('[transaction-state] custom pack schema lookup failed:', error.message);
    }
  }
  return allRequirements[schemaKey] ? schemaKey : 'generic';
}

const CONFIRMED_RECORD_STATUSES = new Set(['verified', 'confirmed', 'source_changed']);
const AWAITING_RECORD_STATUSES = new Set(['extracted', 'needs_review', 'awaiting', 'awaiting_confirmation']);
const CONFLICT_RECORD_STATUSES = new Set(['conflicting', 'conflict']);
const EMPTY_RECORD_VALUES = new Set(['', 'n/a', 'na', 'not applicable', 'not_applicable', 'unknown']);

function hasMeaningfulRecordValue(field) {
  const value = String(field?.value_text || field?.value_json || field?.value || '').trim().toLowerCase();
  return !EMPTY_RECORD_VALUES.has(value) && field?.status !== 'not_applicable';
}

function recordStatusRank(field) {
  const status = String(field?.status || '').toLowerCase();
  if (CONFLICT_RECORD_STATUSES.has(status)) return 5;
  if (CONFIRMED_RECORD_STATUSES.has(status)) return 4;
  if (AWAITING_RECORD_STATUSES.has(status)) return 3;
  if (hasMeaningfulRecordValue(field)) return 2;
  if (status === 'not_applicable') return 1;
  return 0;
}

/**
 * Resolve one authoritative state for every canonical Transaction Record key.
 * Older rooms can contain aliases or legacy "confirmed" rows, while newer
 * extraction writes canonical keys and uses "verified".
 */
function computeTransactionRecordState(recordFields, schemaKey) {
  const allRequirements = getRequirements();
  const requiredKeys = [...new Set(allRequirements[schemaKey] || [])];
  const canonicalKey = field => canonicalizeTransactionRecordKey(field, schemaKey);
  const byKey = new Map();

  for (const field of recordFields || []) {
    const key = canonicalKey(field?.field_key);
    if (!key) continue;
    const current = byKey.get(key);
    const isCanonical = field.field_key === key;
    const currentIsCanonical = current?.field?.field_key === key;
    const rank = recordStatusRank(field);
    // A verified value wins over a stale extracted alias row. A canonical row
    // wins over an alias when both rows have the same state.
    if (!current || rank > current.rank || (rank === current.rank && isCanonical && !currentIsCanonical)) {
      byKey.set(key, { field, rank });
    }
  }

  const fields = [...byKey.entries()].map(([key, entry]) => {
    const field = entry.field;
    const rawStatus = String(field.status || '').toLowerCase();
    const status = CONFLICT_RECORD_STATUSES.has(rawStatus)
      ? 'conflict'
      : CONFIRMED_RECORD_STATUSES.has(rawStatus)
        ? 'confirmed'
        : AWAITING_RECORD_STATUSES.has(rawStatus)
          ? 'awaiting'
          : rawStatus === 'not_applicable'
            ? 'not_applicable'
            : hasMeaningfulRecordValue(field)
              ? 'captured'
              : 'missing';
    return {
      key,
      fieldId: field.id || null,
      label: field.display_label || key,
      value: field.value_text || field.value_json || null,
      status,
      rawStatus: rawStatus || null,
      attention: rawStatus === 'source_changed' ? 'source_changed' : null,
      required: requiredKeys.includes(key),
      updatedAt: field.updated_at || field.created_at || null,
    };
  });

  const fieldByKey = new Map(fields.map(field => [field.key, field]));
  const notApplicableKeys = new Set(fields
    .filter(field => field.status === 'not_applicable')
    .map(field => field.key));
  const activeRequiredKeys = requiredKeys.filter(key => !notApplicableKeys.has(key));
  const requiredFields = activeRequiredKeys.map(key => fieldByKey.get(key) || {
    key,
    label: key,
    value: null,
    status: 'missing',
    rawStatus: null,
    attention: null,
    required: true,
    updatedAt: null,
  });
  const count = (items, status) => items.filter(field => field.status === status).length;
  const confirmedCount = count(requiredFields, 'confirmed');
  const awaitingRequiredCount = count(requiredFields, 'awaiting');

  return {
    schemaKey,
    fields,
    requiredFields,
    requiredCount: requiredFields.length,
    confirmedCount,
    awaitingCount: count(fields, 'awaiting'),
    awaitingRequiredCount,
    awaitingOptionalCount: Math.max(0, count(fields, 'awaiting') - awaitingRequiredCount),
    conflictCount: fields.filter(field => field.status === 'conflict' || field.attention === 'source_changed').length,
    conflictRequiredCount: requiredFields.filter(field =>
      field.status === 'conflict' || field.attention === 'source_changed'
    ).length,
    notApplicableCount: notApplicableKeys.size,
    activeRequiredKeys,
  };
}

function computeTransactionReadiness(room, recordFields, schemaKey) {
  const recordState = computeTransactionRecordState(recordFields, schemaKey);
  const populated = recordState.fields.filter(field =>
    field.status === 'confirmed' && hasMeaningfulRecordValue(field)
  );
  const confirmedCount = recordState.confirmedCount;
  const requiredCount = recordState.requiredCount;
  const overall = requiredCount > 0 ? Math.round((confirmedCount / requiredCount) * 100) : 0;
  const overallLabel = overall >= 80
    ? 'Closing Ready'
    : overall >= 55
      ? 'Needs Review'
      : overall === 0
        ? 'Getting Started'
        : 'Needs Attention';
  const tokenizationGuidance = buildTokenizationGuidance({
    recordState,
    recordFields,
    enabled: true,
  });
  const confirmedTokenizationInputs = tokenizationGuidance.known.filter(field =>
    ['verified', 'confirmed'].includes(field.status)
  ).length;
  const digitalAssetPercent = Math.min(
    100,
    Math.round((confirmedTokenizationInputs / tokenizationGuidance.inputCount) * 100),
  );
  const digitalAssetSufficient = tokenizationGuidance.complete;

  return {
    overall,
    overallLabel,
    confirmedCount,
    requiredCount,
    notApplicableCount: recordState.notApplicableCount,
    digitalAssetPercent,
    digitalAssetSufficient,
    digitalAssetConfirmedInputCount: confirmedTokenizationInputs,
    digitalAssetRequiredInputCount: tokenizationGuidance.inputCount,
    digitalAssetGapCount: tokenizationGuidance.gaps.length,
    populatedCount: populated.length,
    recordState,
    categories: [{ name: 'Structured Transaction Record', weight: 1, score: overall }],
  };
}

async function readTransactionState(propertyId) {
  const [{ data: room, error: roomError }, { data: recordFields, error: fieldsError }] = await Promise.all([
    supabase
      .from('deal_rooms')
      .select('id, property_id, workflow_pack_id, deal_type, deal_stage, jurisdiction, metadata_values, checklist_items')
      .eq('property_id', propertyId)
      .maybeSingle(),
    supabase
      .from('transaction_record_fields')
      .select('field_key, value_text, status, source_doc_id, source_page, source_excerpt, confidence, updated_at')
      .eq('property_id', propertyId),
  ]);
  if (roomError) throw roomError;
  if (fieldsError) throw fieldsError;
  const schemaKey = await resolveSchemaKey(room);
  const packId = await getRoomPackId(propertyId);
  return {
    room,
    recordFields: recordFields || [],
    schemaKey,
    packId,
    stage: room?.deal_stage || null,
    readiness: computeTransactionReadiness(room, recordFields || [], schemaKey),
    recordState: computeTransactionRecordState(recordFields || [], schemaKey),
  };
}

async function recalculateTransactionState(propertyId, options = {}) {
  const correlationId = options.correlationId || crypto.randomUUID();
  const before = options.before || await readTransactionState(propertyId);
  let createdTasks = [];
  let createdReadinessTasks = [];

  if (options.evaluateTasks !== false) {
    createdTasks = await evaluateDealRoomForTasks(propertyId, { correlationId });
    const currentTasks = await listTasksForRoom(propertyId);
    createdReadinessTasks = await evaluateReadinessTasks(propertyId, currentTasks, { correlationId });
  }

  const after = await readTransactionState(propertyId);
  const { clearCache } = require('./operationsManager');
  clearCache(propertyId);
  const payload = {
    propertyId,
    roomId: after.room?.id || null,
    packId: after.packId,
    stageKey: after.stage,
    readiness: after.readiness,
    beforeReadiness: before.readiness,
    createdTaskCount: createdTasks.length + createdReadinessTasks.length,
    correlationId,
    source: options.source || 'transaction_state',
  };
  emit('transaction_state.recalculated', payload, {
    correlationId,
    source: options.source || 'transaction_state',
    orgId: after.room?.org_id || null,
    actorId: options.actorId || null,
    actorType: options.actorType || null,
  });
  logEvent(
    propertyId,
    'transaction_state_recalculated',
    options.actorType || 'system',
    options.actorId || null,
    `Transaction state recalculated from ${options.source || 'transaction_state'}`,
    {
      correlationId,
      source: options.source || 'transaction_state',
      before: before.readiness,
      after: after.readiness,
      createdTaskCount: payload.createdTaskCount,
    },
  ).catch(() => {});
  return {
    ...payload,
    changed: before.readiness.overall !== after.readiness.overall
      || before.recordFields.length !== after.recordFields.length,
    state: after,
  };
}

module.exports = {
  getRequirements,
  resolveSchemaKey,
  computeTransactionReadiness,
  computeTransactionRecordState,
  readTransactionState,
  recalculateTransactionState,
};