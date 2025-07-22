module.exports = function requireRole(required) {
  const roles = Array.isArray(required) ? required : [required];
  return function(req, res, next) {
    if (!req.role || !roles.includes(req.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
};
