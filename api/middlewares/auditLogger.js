const { logAuditEntry } = require('../auditLogger');

const REDACT_FIELDS = ['password', 'token', 'secret'];

function cloneAndRedact(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(cloneAndRedact);
  return Object.entries(value).reduce((acc, [key, val]) => {
    if (REDACT_FIELDS.some((field) => key.toLowerCase().includes(field))) {
      acc[key] = '***redacted***';
    } else if (typeof val === 'object' && val !== null) {
      acc[key] = cloneAndRedact(val);
    } else {
      acc[key] = val;
    }
    return acc;
  }, {});
}

module.exports = function auditLogger(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    try {
      const durationMs = Date.now() - started;
      const entry = {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs,
        userId: req.user ? req.user.id : null,
        organizationId: req.organizationId || null,
        body: cloneAndRedact(req.body || {}),
        query: cloneAndRedact(req.query || {}),
        ip: req.ip,
      };
      logAuditEntry(entry);
    } catch (err) {
      console.error('Failed to record audit entry:', err);
    }
  });
  next();
};
