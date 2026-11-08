'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
const configPath = process.argv[3];
if (!root || !fs.existsSync(root) || !configPath || !fs.existsSync(configPath)) {
  console.error('Usage: node scripts/check-staging-asset-endpoints.cjs <asset-directory> <vercel-config>');
  process.exit(2);
}

const files = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (/\.(?:js|mjs|css|html)$/i.test(entry.name)) files.push(file);
  }
}
collect(root);
const bundle = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const apiRewrites = (config.rewrites || []).filter(rewrite => rewrite.source === '/api/:path*');
const productionHosts = ['kontraplatform.com', 'kontraui.com', 'www.kontraui.com', 'kontra-ui.vercel.app'];
const isStagingConfig = path.basename(configPath) === 'vercel.staging.json';
const productionApi = 'https://kontra-api.onrender.com/api/:path*';
const stagingApi = 'https://api-staging.kontraplatform.com/api/:path*';
const forbidden = [
  ['production Supabase project', /jfhojgtnmcfqretrrxam(?:\.supabase\.co)?/i],
  ['local API origin', /https?:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3001|5000|8000|8080)(?:\/|["'\\])/i],
];
const failures = forbidden.filter(([, pattern]) => pattern.test(bundle)).map(([label]) => label);
if (config.env?.VITE_API_ROUTING_MODE !== 'same-origin') failures.push('config is not same-origin');
if (isStagingConfig) {
  if (!apiRewrites.length || apiRewrites.some(rewrite => rewrite.destination !== stagingApi)) {
    failures.push('staging API routes must map only to the staging API');
  }
} else {
  for (const host of productionHosts) {
    const matching = apiRewrites.find(rewrite => rewrite.has?.some(
      condition => condition.type === 'host' && condition.value === host,
    ));
    if (matching?.destination !== productionApi) {
      failures.push(`production host ${host} does not map to the production API`);
    }
  }
  const stagingHostRewrite = apiRewrites.find(rewrite => rewrite.has?.some(
    condition => condition.type === 'host' && condition.value === 'staging.kontraplatform.com',
  ));
  const fallbackRewrite = apiRewrites.find(rewrite => !rewrite.has && !rewrite.missing);
  if (stagingHostRewrite?.destination !== stagingApi) failures.push('staging hostname does not map to the staging API');
  if (fallbackRewrite?.destination !== stagingApi) failures.push('unknown hosts do not fail closed to the staging API');
}
if (/https?:\/\/(?:api-staging\.kontraplatform\.com|kontra-api\.onrender\.com)/i.test(bundle)) {
  failures.push('absolute API origin embedded in same-origin assets');
}
if (failures.length) {
  console.error(`Deployment asset endpoint scan failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`Scanned ${files.length} built assets; API routes match ${isStagingConfig ? 'staging' : 'production'} routing.`);
