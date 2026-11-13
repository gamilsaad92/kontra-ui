'use strict';

const fs = require('node:fs');
const path = require('node:path');

const stagingApi = 'https://api-staging.kontraplatform.com/api/:path*';

function validateVercelApiRouting(config) {
  const rewrites = (config.rewrites || []).filter(rule => rule.source === '/api/:path*');
  const failures = [];

  if (config.env?.VITE_API_ROUTING_MODE !== 'same-origin') {
    failures.push('VITE_API_ROUTING_MODE must be same-origin');
  }

  if (config.env?.VITE_SUPABASE_URL !== 'https://jpemuoapbgzwapydqiio.supabase.co') {
    failures.push('VITE_SUPABASE_URL must identify the approved staging Supabase project');
  }

  if (config.env?.VITE_AUTO_LOGIN !== 'false') {
    failures.push('VITE_AUTO_LOGIN must be false');
  }

  if (!rewrites.some(rule => !rule.has && !rule.missing && rule.destination === stagingApi)) {
    failures.push('all hosts and preview deployments must map to the staging API');
  }

  for (const rule of rewrites) {
    if (rule.destination !== stagingApi) {
      failures.push(`unexpected API rewrite destination: ${rule.destination}`);
    }
  }

  for (const key of ['VITE_API_BASE', 'VITE_API_BASE_URL', 'VITE_API_URL']) {
    if (config.env?.[key]) {
      failures.push(`${key} must not bypass same-origin staging routing`);
    }
  }

  return failures;
}

if (require.main === module) {
  const configPath = path.resolve(__dirname, '../ui/vercel.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const failures = validateVercelApiRouting(config);
  if (failures.length) {
    console.error(`Vercel API routing check failed: ${failures.join('; ')}`);
    process.exit(1);
  }
  console.log('Vercel API routing is staging-only: all API requests use the approved staging API.');
}

module.exports = { validateVercelApiRouting };
