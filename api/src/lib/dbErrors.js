// PostgreSQL error codes (raw DB errors)
// PostgREST wraps them: PGRST204 = column not in schema cache (≈ 42703),
//                       PGRST106 = schema not found (≈ 42P01)
const SCHEMA_MISSING_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST106']);

// PostgreSQL constraint violation codes
// 23502 = not_null_violation, 23503 = foreign_key_violation,
// 23505 = unique_violation,   23514 = check_violation
const CONSTRAINT_CODES = new Set(['23502', '23503', '23505', '23514']);

function isSchemaMissingError(error) {
  return Boolean(error && SCHEMA_MISSING_CODES.has(error.code));
}

function isConstraintError(error) {
  return Boolean(error && CONSTRAINT_CODES.has(error.code));
}

function asApiError(error, fallbackMessage = 'Database request failed') {
  if (isSchemaMissingError(error)) {
    const apiError = new Error('Feature not enabled: schema missing');
    apiError.status = 501;
    apiError.code = 'SCHEMA_MISSING';
    return apiError;
  }

  if (isConstraintError(error)) {
    const apiError = new Error(error.message || 'Data constraint violation');
    apiError.status = 400;
    apiError.code = 'CONSTRAINT_VIOLATION';
    apiError.pgCode = error.code;
    return apiError;
  }

  console.error('[DB_ERROR] code=%s msg=%s details=%s hint=%s', error?.code, error?.message, error?.details, error?.hint);
  const apiError = new Error(fallbackMessage);
  apiError.status = 500;
  apiError.code = 'DB_ERROR';
  return apiError;
}

module.exports = {
  isSchemaMissingError,
  asApiError,
};
