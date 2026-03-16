const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

async function connect() {
  if (redis.status !== 'ready' && redis.status !== 'connecting') {
    await redis.connect().catch(() => {});
  }
}

module.exports = {
  set: async (key, value, ttlSec) => { await connect(); return redis.set(key, value, 'EX', ttlSec); },
  get: async (key) => { await connect(); return redis.get(key); },
  del: async (key) => { await connect(); return redis.del(key); },
};
