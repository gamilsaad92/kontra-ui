/**
 * IP-based rate limiter for public (unauthenticated) AI endpoints.
 * 15 analyses per hour per IP — enough for genuine exploration, limits abuse.
 */
const buckets = new Map();
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 15;

// Evict stale buckets every 10 minutes to prevent memory leak
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, bucket] of buckets) {
    if (bucket.start < cutoff) buckets.delete(ip);
  }
}, 10 * 60 * 1000);

module.exports = function aiRateLimit(req, res, next) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    'unknown';

  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
    bucket = { start: now, count: 0 };
  }
  bucket.count += 1;
  buckets.set(ip, bucket);

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - bucket.count));

  if (bucket.count > MAX_REQUESTS) {
    const retryMinutes = Math.ceil((bucket.start + WINDOW_MS - now) / 60000);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Free AI tools allow ${MAX_REQUESTS} analyses per hour. Create a free account for higher limits.`,
      retryAfter: `${retryMinutes} minutes`,
    });
  }
  next();
};
