const { isSchemaMissingError } = require('../lib/dbErrors');

function isZodError(error) {
  return Boolean(error && (error.name === 'ZodError' || Array.isArray(error.issues)));
}

function errorHandler(error, _req, res, _next) {
  if (res.headersSent) {
    return;
  }

  if (isZodError(error)) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: error.message || 'Validation failed',
      details: error.issues || [],
    });
  }

    if (error?.code === 'SCHEMA_MISSING' || isSchemaMissingError(error)) {
    return res.status(501).json({
      code: 'SCHEMA_MISSING',
      message: 'Feature not enabled: schema missing',
      status: 501,
    });
  }

  const status = error?.status || error?.statusCode || 500;
  const code = error?.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
   const isServerError = status >= 500;
  const message = isServerError ? 'Unexpected server error' : (error?.message || 'Request failed');

  return res.status(status).json({
    code,
    message,
    status,
   ...(error?.details && !isServerError ? { details: error.details } : {}),
  });
}

module.exports = { errorHandler };
