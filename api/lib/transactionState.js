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

function computeTransactionReadiness(room, recordFields, schemaKey) {
  const allRequirements = getRequirements();
  const requiredKeys = allRequirements[schemaKey] || [];
  const canonicalKey = field => canonicalizeTransactionRecordKey(field, schemaKey);
  const populated = (recordFields || []).filter(field => {
    const value = String(field.value_text || '').trim().toLowerCase();
    return value
      && !['n/a', 'na', 'not applicable', 'not_applicable', 'unknown'].includes(value)
      && field.status === 'verified';
  });
  const notApplicableKeys = new Set((recordFields || [])
    .filter(field => field.status === 'not_applicable')
    .map(field => canonicalKey(field.field_key)));
  const activeRequiredKeys = requiredKeys.filter(key => !notApplicableKeys.has(key));
  const confirmedKeys = new Set(populated.map(field => canonicalKey(field.field_key)));
  const confirmedCount = activeRequiredKeys.filter(key => confirmedKeys.has(key)).length;
  const requiredCount = activeRequiredKeys.length;
  const overall = requiredCount > 0 ? Math.round((confirmedCount / requiredCount) * 100) : 0;
  const overallLabel = overall >= 80
    ? 'Closing Ready'
    : overall >= 55
      ? 'Needs Review'
      : overall === 0
        ? 'Getting Started'
        : 'Needs Attention';
  const hasTransactionFact = populated.some(field => field.field_key?.startsWith('transaction.'));
  const hasAssetOrPartyFact = populated.some(field =>
    field.field_key?.startsWith('asset.') || field.field_key?.startsWith('parties.')
  );
  const digitalAssetPercent = Math.min(
    100,
    Math.round((populated.length / 8) * 70)
      + (hasTransactionFact ? 15 : 0)
      + (hasAssetOrPartyFact ? 15 : 0),
  );
  const digitalAssetSufficient = populated.length >= 4 && hasTransactionFact && hasAssetOrPartyFact;

  return {
    overall,
    overallLabel,
    confirmedCount,
    requiredCount,
    notApplicableCount: notApplicableKeys.size,
    digitalAssetPercent,
    digitalAssetSufficient,
    populatedCount: populated.length,
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
  readTransactionState,
  recalculateTransactionState,
};