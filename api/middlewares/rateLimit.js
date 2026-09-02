const WINDOW_MS = 60 * 1000;
const MAX_COUNT = 60;
const buckets = new Map();

module.exports = function rateLimit(req, res, next) {
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) {
    return next();
  }
 const orgId =
    req.organizationId || req.headers['x-organization-id'] || req.headers['x-org-id'] || req.ip;
  const now = Date.now();
  let bucket = buckets.get(orgId);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
    bucket = { start: now, count: 0 };
  }
  bucket.count += 1;
  buckets.set(orgId, bucket);
  if (bucket.count > MAX_COUNT) {
    return res.status(429).json({ message: 'Rate limit exceeded' });
  }
  next();
};
