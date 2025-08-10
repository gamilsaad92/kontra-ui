const { logAuditEntry } = require('../auditLogger');

module.exports = function auditLogger(req, res, next) {
  res.on('finish', () => {
   const entry = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      userId: req.user ? req.user.id : null,
      data: req.body || {}
    };
    logAuditEntry(entry);
  });
  next();
};
