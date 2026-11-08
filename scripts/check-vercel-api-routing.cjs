'use strict';

const fs = require('node:fs');
const path = require('node:path');

const productionApi = 'https://kontra-api.onrender.com/api/:path*';
const stagingApi = 'https://api-staging.kontraplatform.com/api/:path*';
const productionHosts = ['kontraplatform.com', 'kontraui.com', 'www.kontraui.com', 'kontra-ui.vercel.app'];

function validateVercelApiRouting(config) {
  const rewrites = (config.rewrites || []).filter(rule => rule.source === '/api/:path*');
  const failures = [];

  if (config.env?.VITE_API_ROUTING_MODE !== 'same-origin') {
    failures.push('VITE_API_ROUTING_MODE must be same-origin');
  }

  for (const host of productionHosts) {
    const rule = rewrites.find(candidate => candidate.has?.some(
      condition => condition.type === 'host' && condition.value === host,
    ));
    if (rule?.destination !== productionApi) {
      failures.push(`production host ${host} must map to the production API`);
    }
  }

  const stagingRule = rewrites.find(rule => rule.has?.some(
    condition => condition.type === 'host' && condition.value === 'staging.kontraplatform.com',
  ));
  if (stagingRule?.destination !== stagingApi) {
    failures.push('staging.kontraplatform.com must map to the staging API');
  }

  const fallback = rewrites.find(rule => !rule.has && !rule.missing);
  if (fallback?.destination !== stagingApi) {
    failures.push('unknown hosts and preview deployments must map to the staging API');
  }

  for (const rule of rewrites) {
    if (rule.destination === productionApi) {
      const host = rule.has?.find(condition => condition.type === 'host')?.value;
      if (!productionHosts.includes(host)) {
        failures.push('production API destination appears outside the approved production host allowlist');
      }
    } else if (rule.destination !== stagingApi) {
      failures.push(`unexpected API rewrite destination: ${rule.destination}`);
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
  console.log('Vercel API routing is fail-closed: approved production hosts use production; all others use staging.');
}

module.exports = { validateVercelApiRouting };
