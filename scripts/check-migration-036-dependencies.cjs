'use strict';

const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const migration024 = read('api/migrations/024_verified_asset_snapshots.sql');
const migration031 = read('api/migrations/031_limit_verified_asset_table_service_role_grants.sql');
const migration036 = read('api/migrations/036_verified_asset_snapshot_access.sql');
const failures = [];

if (!/CREATE TABLE IF NOT EXISTS verified_asset_snapshots/i.test(migration024)) {
  failures.push('migration 024 does not create verified_asset_snapshots');
}
if (!/ON TABLE public\.verified_asset_snapshots[\s\S]*?TO service_role/i.test(migration031)) {
  failures.push('migration 031 does not grant service_role access to verified_asset_snapshots');
}
if (!/verified_asset_snapshots/i.test(migration036)) {
  failures.push('migration 036 does not target verified_asset_snapshots');
}
if (/\b035\b/.test(migration036)) {
  failures.push('migration 036 references excluded migration 035');
}

if (failures.length) {
  console.error(`Migration dependency check failed: ${failures.join('; ')}`);
  process.exit(1);
}

console.log('Migration 036 depends on the table/grant prerequisites in 024 and 031, not excluded migration 035.');
