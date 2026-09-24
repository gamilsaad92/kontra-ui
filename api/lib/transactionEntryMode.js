'use strict';

const TRANSACTION_ENTRY_MODES = Object.freeze({
  ACTIVE: 'active',
  PREVIOUSLY_COMPLETED: 'previously_completed',
});

const HISTORICAL_STAGE = Object.freeze({
  key: 'historical_verification',
  label: 'Historical Verification',
});

function normalizeTransactionEntryMode(value) {
  if (value == null || String(value).trim() === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (Object.values(TRANSACTION_ENTRY_MODES).includes(normalized)) return normalized;
  const error = new Error(
    `Invalid transaction entry mode. Expected "${TRANSACTION_ENTRY_MODES.ACTIVE}" or "${TRANSACTION_ENTRY_MODES.PREVIOUSLY_COMPLETED}".`,
  );
  error.code = 'INVALID_TRANSACTION_ENTRY_MODE';
  throw error;
}

function isPreviouslyCompletedRoom(roomOrMode) {
  const mode = typeof roomOrMode === 'string'
    ? roomOrMode
    : roomOrMode?.transaction_entry_mode;
  return mode === TRANSACTION_ENTRY_MODES.PREVIOUSLY_COMPLETED;
}

function historicalLifecycleStage(roomOrMode) {
  return isPreviouslyCompletedRoom(roomOrMode) ? { ...HISTORICAL_STAGE } : null;
}

module.exports = {
  TRANSACTION_ENTRY_MODES,
  HISTORICAL_STAGE,
  normalizeTransactionEntryMode,
  isPreviouslyCompletedRoom,
  historicalLifecycleStage,
};