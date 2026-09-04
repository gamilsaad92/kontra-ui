'use strict';

const { supabase } = require('../db');

const DEFAULT_DOCUMENT_BUCKET = 'deal-documents';
const V2_DOCUMENT_BUCKET = 'deal-room-documents';
const STORAGE_PAGE_SIZE = 100;
const STORAGE_REMOVE_BATCH_SIZE = 100;

const PRESERVED_RECORDS = [
  'deal_room_audit_log',
  'verified_asset_snapshots',
  'deal_room_activations',
  'custom_workflow_packs',
];

function isMissingResourceError(error) {
  const message = String(error?.message || error || '');
  return /(?:relation|table|bucket).*?(?:does not exist|not found)|could not find the .*? in the schema cache|schema cache.*?(?:not found|missing)/i.test(message);
}

function describeError(error) {
  return String(error?.message || error || 'Unknown database or storage error');
}

async function readRows(client, table, select, applyFilters, { optional = true } = {}) {
  const query = client.from(table).select(select);
  applyFilters?.(query);
  const result = await query;
  if (!result?.error) return { rows: result?.data || [], skipped: false };
  if (optional && isMissingResourceError(result.error)) {
    return { rows: [], skipped: true };
  }
  throw new Error(`${table} read failed: ${describeError(result.error)}`);
}

async function deleteRows(client, table, applyFilters, { optional = true } = {}) {
  const query = client.from(table).delete();
  applyFilters?.(query);
  const result = await query;
  if (!result?.error) {
    return { count: Array.isArray(result?.data) ? result.data.length : null, skipped: false };
  }
  if (optional && isMissingResourceError(result.error)) {
    return { count: 0, skipped: true };
  }
  throw new Error(`${table} delete failed: ${describeError(result.error)}`);
}

async function deleteRowsByIds(client, table, column, ids, options) {
  if (!ids.length) return { count: 0, skipped: false };
  return deleteRows(client, table, q => q.in(column, ids), options);
}

function storageError(bucket, operation, error) {
  return new Error(`Storage ${operation} failed for ${bucket}: ${describeError(error)}`);
}

function isFolderEntry(entry) {
  return entry?.id == null && entry?.metadata == null;
}

async function listStorageObjects(client, bucket, prefix) {
  const normalizedPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '');
  const pending = [normalizedPrefix];
  const objects = [];

  while (pending.length) {
    const currentPrefix = pending.shift();
    let offset = 0;

    while (true) {
      const result = await client.storage.from(bucket).list(currentPrefix, {
        limit: STORAGE_PAGE_SIZE,
        offset,
      });
      if (result?.error) throw storageError(bucket, `listing ${currentPrefix}`, result.error);

      const entries = result?.data || [];
      for (const entry of entries) {
        if (!entry?.name) continue;
        const path = currentPrefix ? `${currentPrefix}/${entry.name}` : entry.name;
        if (isFolderEntry(entry)) pending.push(path);
        else objects.push(path);
      }

      if (entries.length < STORAGE_PAGE_SIZE) break;
      offset += entries.length;
    }
  }

  return objects;
}

async function removeStoragePaths(client, bucket, paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  let removed = 0;

  for (let index = 0; index < uniquePaths.length; index += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = uniquePaths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);
    const result = await client.storage.from(bucket).remove(batch);
    if (result?.error) throw storageError(bucket, 'removing objects', result.error);
    removed += batch.length;
  }

  return removed;
}

async function removeStoragePrefix(client, bucket, propertyId) {
  const objects = await listStorageObjects(client, bucket, propertyId);
  const removed = await removeStoragePaths(client, bucket, objects);
  const remaining = await listStorageObjects(client, bucket, propertyId);
  if (remaining.length > 0) {
    throw new Error(
      `Storage cleanup incomplete for ${bucket}/${propertyId}: ${remaining.length} object(s) remain`,
    );
  }
  return { discovered: objects.length, removed, remaining: 0 };
}

async function removeArtifactObjects(client, artifacts) {
  const pathsByBucket = new Map();
  for (const artifact of artifacts) {
    if (!artifact?.storage_path) continue;
    const bucket = artifact.storage_bucket || DEFAULT_DOCUMENT_BUCKET;
    const paths = pathsByBucket.get(bucket) || [];
    paths.push(artifact.storage_path);
    pathsByBucket.set(bucket, paths);
  }

  let removed = 0;
  for (const [bucket, paths] of pathsByBucket) {
    removed += await removeStoragePaths(client, bucket, paths);
    const remaining = [];
    const parents = [...new Set(paths.map(path => {
      const separator = path.lastIndexOf('/');
      return separator < 0 ? '' : path.slice(0, separator);
    }))];
    for (const parent of parents) {
      const objects = await listStorageObjects(client, bucket, parent);
      const objectSet = new Set(objects);
      remaining.push(...paths.filter(path => objectSet.has(path)));
    }
    if (remaining.length > 0) {
      throw new Error(
        `Storage cleanup incomplete for ${bucket}: ${remaining.length} referenced artifact object(s) remain`,
      );
    }
  }
  return removed;
}

async function deleteDealRoomData(propertyId, client = supabase) {
  if (!propertyId || typeof propertyId !== 'string') {
    throw new Error('A valid propertyId is required');
  }

  const skippedTables = [];
  const deletedTables = [];
  const markResult = (table, result) => {
    if (result?.skipped) skippedTables.push(table);
    else deletedTables.push(table);
  };

  const [legacyAnalyses, v2Documents, pdfArtifacts, legacyInvites, v2Invites, v2Participants, generationSessions] = await Promise.all([
    readRows(client, 'deal_analyses', 'id, storage_path', q => q.eq('property_id', propertyId), { optional: false }),
    readRows(client, 'deal_room_documents', 'id, storage_path', q => q.eq('property_id', propertyId)),
    readRows(client, 'digital_asset_preparation_pdf_artifacts', 'id, storage_bucket, storage_path', q => q.eq('property_id', propertyId)),
    readRows(client, 'deal_room_invites', 'id', q => q.eq('property_id', propertyId)),
    readRows(client, 'deal_room_invites_v2', 'id', q => q.eq('room_id', propertyId)),
    readRows(client, 'deal_room_participants', 'id', q => q.eq('room_id', propertyId)),
    readRows(client, 'transaction_generation_sessions', 'id', q => q.eq('created_room_id', propertyId)),
  ]);

  if (v2Documents.skipped) skippedTables.push('deal_room_documents');
  if (pdfArtifacts.skipped) skippedTables.push('digital_asset_preparation_pdf_artifacts');
  if (legacyInvites.skipped) skippedTables.push('deal_room_invites');
  if (v2Invites.skipped) skippedTables.push('deal_room_invites_v2');
  if (v2Participants.skipped) skippedTables.push('deal_room_participants');
  if (generationSessions.skipped) skippedTables.push('transaction_generation_sessions');

  const storage = {
    artifactPathsRemoved: await removeArtifactObjects(client, pdfArtifacts.rows),
  };
  if (!v2Documents.skipped) {
    storage.v2DocumentPathsRemoved = await removeArtifactObjects(
      client,
      v2Documents.rows.map(row => ({ ...row, storage_bucket: V2_DOCUMENT_BUCKET })),
    );
  }
  storage[DEFAULT_DOCUMENT_BUCKET] = await removeStoragePrefix(client, DEFAULT_DOCUMENT_BUCKET, propertyId);

  if (!v2Documents.skipped) {
    storage[V2_DOCUMENT_BUCKET] = await removeStoragePrefix(client, V2_DOCUMENT_BUCKET, propertyId);
  }

  const documentResult = await deleteRows(client, 'deal_room_documents', q => q.eq('property_id', propertyId));
  markResult('deal_room_documents', documentResult);

  const pdfResult = await deleteRows(client, 'digital_asset_preparation_pdf_artifacts', q => q.eq('property_id', propertyId));
  markResult('digital_asset_preparation_pdf_artifacts', pdfResult);

  const revisionResult = await deleteRows(client, 'digital_asset_preparation_package_revisions', q => q.eq('property_id', propertyId));
  markResult('digital_asset_preparation_package_revisions', revisionResult);

  const preparationResult = await deleteRows(client, 'digital_asset_preparation_packages', q => q.eq('property_id', propertyId));
  markResult('digital_asset_preparation_packages', preparationResult);

  for (const [table, filter] of [
    ['deal_analyses', q => q.eq('property_id', propertyId)],
    ['transaction_record_conflicts', q => q.eq('property_id', propertyId)],
    ['deal_room_tasks', q => q.eq('property_id', propertyId)],
    ['party_submissions', q => q.eq('property_id', propertyId)],
    ['deal_comments', q => q.eq('property_id', propertyId)],
    ['deal_notifications', q => q.eq('property_id', propertyId)],
    ['deal_events', q => q.eq('property_id', propertyId)],
    ['verified_asset_packages', q => q.eq('property_id', propertyId)],
    ['transaction_record_fields', q => q.eq('property_id', propertyId)],
    ['transaction_generation_sessions', q => q.eq('created_room_id', propertyId)],
  ]) {
    const result = await deleteRows(client, table, filter);
    markResult(table, result);
  }

  const legacySessionResult = await deleteRowsByIds(client, 'deal_room_access_sessions', 'invite_id', legacyInvites.rows.map(row => row.id).filter(Boolean));
  if (!legacyInvites.rows.length && legacySessionResult.skipped) skippedTables.push('deal_room_access_sessions');
  else markResult('deal_room_access_sessions', legacySessionResult);

  const legacyInviteResult = await deleteRows(client, 'deal_room_invites', q => q.eq('property_id', propertyId));
  markResult('deal_room_invites', legacyInviteResult);

  const participantRoleResult = await deleteRowsByIds(client, 'deal_room_participant_roles', 'participant_id', v2Participants.rows.map(row => row.id).filter(Boolean));
  if (!v2Participants.rows.length && participantRoleResult.skipped) skippedTables.push('deal_room_participant_roles');
  else markResult('deal_room_participant_roles', participantRoleResult);

  const otpResult = await deleteRowsByIds(client, 'deal_room_otp_requests', 'invite_id', v2Invites.rows.map(row => row.id).filter(Boolean));
  if (!v2Invites.rows.length && otpResult.skipped) skippedTables.push('deal_room_otp_requests');
  else markResult('deal_room_otp_requests', otpResult);

  const participantResult = await deleteRows(client, 'deal_room_participants', q => q.eq('room_id', propertyId));
  markResult('deal_room_participants', participantResult);

  const v2InviteResult = await deleteRows(client, 'deal_room_invites_v2', q => q.eq('room_id', propertyId));
  markResult('deal_room_invites_v2', v2InviteResult);

  const roomResult = await deleteRows(client, 'deal_rooms', q => q.eq('property_id', propertyId), { optional: false });
  markResult('deal_rooms', roomResult);

  return {
    complete: true,
    propertyId,
    storage,
    deletedTables: [...new Set(deletedTables)],
    skippedTables: [...new Set(skippedTables)],
    preserved: PRESERVED_RECORDS,
    transactionRecordHistory: 'deleted_with_transaction_record_fields',
  };
}

module.exports = {
  DEFAULT_DOCUMENT_BUCKET,
  V2_DOCUMENT_BUCKET,
  PRESERVED_RECORDS,
  isMissingResourceError,
  listStorageObjects,
  removeStoragePrefix,
  deleteDealRoomData,
};