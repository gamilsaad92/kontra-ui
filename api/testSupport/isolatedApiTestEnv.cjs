'use strict';

if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV !== 'test') {
  throw new Error('API test isolation may only be loaded in NODE_ENV=test.');
}

for (const name of Object.keys(process.env)) {
  if (/(?:DATABASE|POSTGRES|SUPABASE)/i.test(name)
    || /^(?:PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|PGSERVICE|PGSERVICEFILE|PGSSLMODE|REPLIT_DB.*|DB_.*)$/i.test(name)
    || /^(?:OPENAI_API_KEY1|AI_INTEGRATIONS_OPENAI_API_KEY|AI_INTEGRATIONS_OPENAI_BASE_URL|STAGING_OPENAI_API_KEY|KONTRA_STAGING_ISOLATION)$/i.test(name)) {
    delete process.env[name];
  }
}

process.env.KONTRA_TEST_ISOLATION = 'true';
process.env.OPENAI_API_KEY = 'ci-test-key-not-valid';

const blockLiveConnection = () => {
  throw new Error('[test isolation] Live database connections are blocked.');
};
const { Pool, Client } = require('pg');
for (const DatabaseClient of [Pool, Client]) {
  if (!DatabaseClient?.prototype) continue;
  DatabaseClient.prototype.connect = blockLiveConnection;
  DatabaseClient.prototype.query = blockLiveConnection;
}

if (typeof globalThis.fetch === 'function') {
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, ...args) => {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    let hostname;
    try {
      hostname = new URL(rawUrl).hostname.toLowerCase();
    } catch {
      throw new Error('[test isolation] Invalid outbound URL blocked.');
    }
    if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
      throw new Error('[test isolation] Outbound network requests are blocked.');
    }
    return originalFetch(input, ...args);
  };
}
