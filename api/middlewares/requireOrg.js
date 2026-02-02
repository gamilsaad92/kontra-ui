module.exports = function requireOrg(req, res, next) {
   const orgId =
    req.organizationId || req.headers['x-organization-id'] || req.headers['x-org-id'];
  if (!orgId) {
    return res.status(400).json({ message: 'Missing organization id' });
  }
  req.orgId = orgId;
  next();
};
