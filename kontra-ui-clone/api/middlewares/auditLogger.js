const { logAuditEntry } = require('../auditLogger');

module.exports = function auditLogger(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    try {
      const durationMs = Date.now() - started;
      const entry = {
        method: req.method,
        url: `${req.baseUrl || ''}${req.path || ''}`,
        status: res.statusCode,
        durationMs,
        userId: req.user ? req.user.id : null,
        organizationId: req.organizationId || req.headers['x-organization-id'] || null,
        roomId: req.params?.propertyId || req.params?.roomId || null,
        requestId: req.headers['x-request-id'] || null,
        inputBytes: Number(req.headers['content-length']) || 0,
        contentType: req.headers['content-type'] || null,
        bodyKeyCount: Object.keys(req.body || {}).length,
        queryKeyCount: Object.keys(req.query || {}).length,
        fileCount: req.file ? 1 : Array.isArray(req.files) ? req.files.length : 0,
      };
      logAuditEntry(entry);
    } catch (err) {
      console.error('Failed to record audit entry:', err);
    }
  });
  next();
};
