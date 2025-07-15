let redisClient = null;
try {
  const { createClient } = require('redis');
  redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.connect().catch(err => {
    console.error('Redis connection failed:', err);
    redisClient = null;
  });
} catch (err) {
  console.warn('Redis package not installed, falling back to memory cache');
}

const memoryCache = new Map();

async function get(key) {
  if (redisClient) {
    try {
      const val = await redisClient.get(key);
      if (val) return JSON.parse(val);
    } catch (err) {
      console.error('Redis get error:', err);
    }
  }
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.exp) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

async function set(key, data, ttlSec = 60) {
  if (redisClient) {
    try {
      await redisClient.setEx(key, ttlSec, JSON.stringify(data));
    } catch (err) {
      console.error('Redis set error:', err);
    }
  }
  memoryCache.set(key, { data, exp: Date.now() + ttlSec * 1000 });
}

module.exports = { get, set };
