'use strict';

const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204']);
const ROOM_CREATION_COLUMNS = Object.freeze([
  'workflow_pack_id',
  'stages_config',
  'base_pack',
  'transaction_type',
  'transaction_subtype',
  'transaction_context',
  'generated_proposal',
  'transaction_entry_mode',
  'is_pilot',
]);

function errorText(error) {
  return [
    error?.message,
    error?.details,
    error?.hint,
  ].filter(Boolean).join(' ');
}

function hasSchemaCacheLanguage(error) {
  return /does not exist|schema cache|could not find|not found/i.test(errorText(error));
}

function isMissingRoomColumn(error, column) {
  if (!error || !column || !MISSING_COLUMN_CODES.has(error.code) || !hasSchemaCacheLanguage(error)) {
    return false;
  }

  // Require the actual column name in the database error. A bare 42703 or
  // PGRST204 does not identify which migration is missing and must not be
  // classified as migration 029.
  return new RegExp(`(?:^|[^a-z0-9_])${String(column).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9_])`, 'i')
    .test(errorText(error));
}

function classifyDealRoomSchemaError(error) {
  const missingColumn = ROOM_CREATION_COLUMNS.find(column => isMissingRoomColumn(error, column)) || null;
  return {
    isSchemaIncompatibility: Boolean(missingColumn),
    missingColumn,
  };
}

function createHistoricalRoomMigrationError(error) {
  if (!isMissingRoomColumn(error, 'transaction_entry_mode')) return null;

  const classified = new Error(
    'Previously completed workspaces require migration 029_transaction_entry_mode.sql before creation.',
  );
  classified.code = 'HISTORICAL_ROOM_MIGRATION_REQUIRED';
  classified.statusCode = 503;
  return classified;
}

module.exports = {
  ROOM_CREATION_COLUMNS,
  classifyDealRoomSchemaError,
  createHistoricalRoomMigrationError,
  isMissingRoomColumn,
};