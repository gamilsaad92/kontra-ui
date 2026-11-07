'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
const configPath = process.argv[3];
if (!root || !fs.existsSync(root) || !configPath || !fs.existsSync(configPath)) {
  console.error('Usage: node scripts/check-staging-asset-endpoints.cjs <asset-directory> <staging-vercel-config>');
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
const apiRewrite = config.rewrites?.find(rewrite => rewrite.source === '/api/:path*');
const stagingConfig = configPath.endsWith('vercel.staging.json');
const expectedApi = stagingConfig
  ? 'https://api-staging.kontraplatform.com/api/:path*'
  : 'https://kontra-api.onrender.com/api/:path*';
const forbidden = [
  [stagingConfig ? 'production API' : 'staging API', stagingConfig
    ? /https?:\/\/kontra-api\.onrender\.com/i
    : /https?:\/\/api-staging\.kontraplatform\.com/i],
  ['production Supabase project', /jfhojgtnmcfqretrrxam(?:\.supabase\.co)?/i],
  ['local API origin', /https?:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3001|5000|8000|8080)(?:\/|["'\\])/i],
];
const failures = forbidden.filter(([, pattern]) => pattern.test(bundle)).map(([label]) => label);
if (config.env?.VITE_API_ROUTING_MODE !== 'same-origin') failures.push('config is not same-origin');
if (apiRewrite?.destination !== expectedApi) {
  failures.push('checked-in /api rewrite does not target the expected environment API');
}
if (/https?:\/\/(?:api-staging\.kontraplatform\.com|kontra-api\.onrender\.com)/i.test(bundle)) {
  failures.push('absolute API origin embedded in same-origin assets');
}
if (failures.length) {
  console.error(`Deployment asset endpoint scan failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`Scanned ${files.length} built assets; the same-origin rewrite targets ${apiRewrite.destination}.`);
