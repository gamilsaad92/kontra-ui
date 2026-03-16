const MISSING_SCHEMA_CODES = new Set(['42P01', '42703']);

function isMissingSchemaError(error) {
  return Boolean(error && MISSING_SCHEMA_CODES.has(error.code));
}

function handleMissingSchemaError(res, error, context, payload) {
  if (!isMissingSchemaError(error)) {
    return false;
  }

  const message = 'missing schema, run migrations';
  console.warn(`${context}: ${message}`, {
    code: error?.code,
    details: error?.message,
  });

 res.status(200).json(payload);
  return true;
}

module.exports = {
  handleMissingSchemaError,
  isMissingSchemaError,
};
