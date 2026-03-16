const SCHEMA_MISSING_CODES = new Set(['42P01', '42703']);

function isSchemaMissingError(error) {
  return Boolean(error && SCHEMA_MISSING_CODES.has(error.code));
}

function asApiError(error, fallbackMessage = 'Database request failed') {
  if (isSchemaMissingError(error)) {
    const apiError = new Error('Feature not enabled: schema missing');
    apiError.status = 501;
    apiError.code = 'SCHEMA_MISSING';
    return apiError;
  }

  const apiError = new Error(fallbackMessage);
  apiError.status = 500;
  apiError.code = 'DB_ERROR';
  return apiError;
}

module.exports = {
  isSchemaMissingError,
  asApiError,
};
