'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const failures = [];

const migrations = [
  ['025', 'api/migrations/025_digital_asset_preparation_packages.sql', 'digital_asset_preparation_packages'],
  ['026', 'api/migrations/026_digital_asset_preparation_package_revisions.sql', 'digital_asset_preparation_package_revisions'],
  ['027', 'api/migrations/027_digital_asset_preparation_pdf_artifacts.sql', 'digital_asset_preparation_pdf_artifacts'],
];

for (const [version, file, table] of migrations) {
  const sql = read(file);
  if (!/(^|\n)\s*BEGIN\s*;/i.test(sql) || !/COMMIT\s*;\s*$/i.test(sql)) {
    failures.push(`${version} must apply its DDL and grants atomically`);
  }
  if (!new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`, 'i').test(sql)) {
    failures.push(`${version} does not create ${table}`);
  }
  if (!new RegExp(`REVOKE ALL PRIVILEGES ON TABLE public\\.${table}[\\s\\S]*?FROM PUBLIC, anon, authenticated, service_role`, 'i').test(sql)) {
    failures.push(`${version} does not revoke inherited table grants on ${table}`);
  }
  if (!new RegExp(`GRANT SELECT, INSERT, DELETE ON TABLE public\\.${table}\\s+TO service_role`, 'i').test(sql)) {
    failures.push(`${version} does not grant the required least-privilege access on ${table}`);
  }
  if (!new RegExp(`ON ${table} FOR ALL TO service_role`, 'i').test(sql)) {
    failures.push(`${version} does not scope its RLS policy to service_role`);
  }
  if (!/RAISE EXCEPTION/i.test(sql) || !/relrowsecurity/i.test(sql)) {
    failures.push(`${version} is missing a fail-closed RLS/schema verification`);
  }
}

const migration026 = read(migrations[1][1]);
const migration027 = read(migrations[2][1]);
const migration031 = read('api/migrations/031_limit_verified_asset_table_service_role_grants.sql');
if (!/verified_asset_snapshots/i.test(read(migrations[0][1]))) failures.push('025 dependency on 024 is missing');
if (!/digital_asset_preparation_packages/i.test(migration026)) failures.push('026 dependency on 025 is missing');
if (!/digital_asset_preparation_package_revisions/i.test(migration027)) failures.push('027 dependency on 026 is missing');
if (!/digital_asset_preparation_pdf_artifacts/i.test(migration031)) failures.push('031 artifact-table prerequisite is missing');
if (!/digital_asset_preparation_packages[\s\S]*digital_asset_preparation_package_revisions[\s\S]*digital_asset_preparation_pdf_artifacts/.test(migration031)) {
  failures.push('031 does not secure all three preparation tables in dependency order');
}
if (/ALTER\s+DEFAULT\s+PRIVILEGES/i.test(migration031.replace(/--.*$/gm, ''))) {
  failures.push('031 must use targeted table ACLs, not assume default-ACL changes affect existing tables');
}
if (!/has_schema_privilege/i.test(migration031)
  || !/pg_depend[\s\S]*relkind\s*=\s*'S'/i.test(migration031)
  || !/pg_proc[\s\S]*proname/i.test(migration031)) {
  failures.push('031 is missing schema, sequence, or function-prerequisite checks');
}

if (failures.length) {
  console.error(failures.map(failure => `FAIL: ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Staging asset migrations have ordered prerequisites, atomic targeted ACLs, RLS checks, and least-privilege verification.');
}
