module.exports = function requireRole(required) {
  const roles = Array.isArray(required) ? required : [required];
  return function(req, res, next) {
    // Public deal-room endpoints use owner-write-token / invite-session auth and
    // are never role-gated. Skip the role check so that requireRole('admin')
    // inside app.use('/api', authenticate, requireRole('admin'), complianceRouter)
    // does not block /api/public/* requests that already bypassed authenticate.
    const fullUrl    = req.originalUrl || '';
    const mountedUrl = req.url || '';
    if (fullUrl.includes('/api/public/') || mountedUrl.startsWith('/public/')) {
      return next();
    }
    if (!req.role || !roles.includes(req.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
};
