const { logAuditEntry } = require('../auditLogger');

module.exports = function auditLogger(req, res, next) {
  res.on('finish', () => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && res.statusCode < 400) {
      const entry = {
        method: req.method,
        url: req.originalUrl,
        userId: req.user ? req.user.id : null,
        data: req.body || {}
      };
      logAuditEntry(entry);
    }
  });
  next();
};
