'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateVercelApiRouting } = require('./check-vercel-api-routing.cjs');

const config = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../ui/vercel.json'),
  'utf8',
));

test('unknown preview and unexpected hostnames cannot fall through to production', () => {
  assert.deepEqual(validateVercelApiRouting(config), []);

  const productionFallback = {
    ...config,
    rewrites: config.rewrites.map(rule => (
      rule.source === '/api/:path*' && !rule.has
        ? { ...rule, destination: 'https://kontra-api.onrender.com/api/:path*' }
        : rule
    )),
  };
  assert.ok(validateVercelApiRouting(productionFallback)
    .some(message => message.includes('unknown hosts and preview deployments')));
});

test('an unapproved hostname cannot be added to the production API allowlist', () => {
  const configWithUnexpectedProductionHost = {
    ...config,
    rewrites: [
      ...config.rewrites,
      {
        source: '/api/:path*',
        has: [{ type: 'host', value: 'unexpected.example.com' }],
        destination: 'https://kontra-api.onrender.com/api/:path*',
      },
    ],
  };
  assert.ok(validateVercelApiRouting(configWithUnexpectedProductionHost)
    .some(message => message.includes('outside the approved production host allowlist')));
});
