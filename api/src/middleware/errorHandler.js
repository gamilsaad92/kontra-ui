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

  const status = error?.status || error?.statusCode || 500;
  const code = error?.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message = error?.message || 'Unexpected server error';

  return res.status(status).json({
    code,
    message: status >= 500 && !error?.message ? 'Unexpected server error' : message,
    status,
    ...(error?.details ? { details: error.details } : {}),
  });
}

module.exports = { errorHandler };
