'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
if (!root || !fs.existsSync(root)) {
  console.error('Usage: node scripts/check-staging-asset-endpoints.cjs <asset-directory>');
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
const forbidden = [
  ['production API', /https?:\/\/kontra-api\.onrender\.com/i],
  ['production Supabase project', /jfhojgtnmcfqretrrxam(?:\.supabase\.co)?/i],
  ['local API origin', /https?:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3001|5000|8000|8080)(?:\/|["'\\])/i],
];
const failures = forbidden.filter(([, pattern]) => pattern.test(bundle)).map(([label]) => label);
if (!bundle.includes('api-staging.kontraplatform.com')) failures.push('staging API origin missing');
if (failures.length) {
  console.error(`Staging asset endpoint scan failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`Scanned ${files.length} built assets; staging API is configured and forbidden endpoints are absent.`);
