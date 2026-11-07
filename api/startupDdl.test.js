const fs = require('fs');
const path = require('path');

const source = (relativePath) => fs.readFileSync(path.join(__dirname, relativePath), 'utf8');

test('API startup has no schema bootstrap entry points', () => {
  expect(source('index.js')).not.toContain('ensureWorkflowPackIdColumn');
  expect(source('lib/taskEngine.js')).not.toMatch(/^\s*getPg\(\);\s*$/m);
  for (const file of [
    'routers/docs.js',
    'routers/lifecycle.js',
    'routers/market.js',
    'routers/waitlist.js',
  ]) {
    expect(source(file)).not.toMatch(/^\s*bootstrap\(\)(?:\.catch\([^;]*\))?;\s*$/m);
  }
  expect(source('routers/visitors.js')).not.toMatch(/CREATE TABLE/i);
  expect(source('routers/waitlist.js')).not.toMatch(/CREATE TABLE/i);
});
