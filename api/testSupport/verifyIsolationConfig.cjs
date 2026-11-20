'use strict';

const fs = require('node:fs');
const path = require('node:path');

const apiRoot = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(apiRoot, name), 'utf8');
const config = read('jest.config.js');
const scripts = JSON.parse(read('package.json')).scripts;
const runner = read('testSupport/runIsolatedJest.sh');
const preloader = read('testSupport/isolatedApiTestEnv.cjs');
const auditRedirect = read('testSupport/redirectAuditLogForTests.cjs');
const mocks = read('testSupport/mockDatabaseClients.cjs');
const cleanup = read('testSupport/closeTestServers.cjs');
const integration = read('lib/canonicalStateAtomicity.pg.test.js');

const checks = [
  [config, /setupFiles\s*:\s*\[\s*['"]<rootDir>\/testSupport\/isolatedApiTestEnv\.cjs['"]\s*,\s*['"]<rootDir>\/testSupport\/redirectAuditLogForTests\.cjs['"]/, 'The network/database preloader must run first, followed by isolated audit-log redirection.'],
  [config, /setupFilesAfterEnv\s*:\s*\[\s*['"]<rootDir>\/testSupport\/mockDatabaseClients\.cjs['"]\s*,\s*['"]<rootDir>\/testSupport\/closeTestServers\.cjs['"]\s*,?\s*\]/, 'Database mocks and test-handle cleanup must load before test modules.'],
  [config, /KONTRA_TEST_ISOLATION_MODE[\s\S]*canonicalStateAtomicity\.pg\.test\.js/, 'Integration mode must select only the approved local PostgreSQL suite.'],
  [config, /testPathIgnorePatterns[\s\S]*pg[^,\]]*test/, 'Ordinary Jest runs must exclude PostgreSQL integration suites.'],
  [scripts.test, /^env -u NODE_OPTIONS sh testSupport\/runIsolatedJest\.sh$/, 'npm test must use the isolated runner.'],
  [scripts['test:integration:canonical-state'], /--local-postgres[\s\S]*runIsolatedJest\.sh|runIsolatedJest\.sh[\s\S]*--local-postgres/, 'The integration script must use the isolated runner.'],
  [runner, /env -i/, 'The runner must start with a clean environment.'],
  [runner, /KONTRA_ALLOW_LOCAL_POSTGRES_INTEGRATION/, 'Local PostgreSQL integration must require explicit opt-in.'],
  [runner, /restricted to the canonical-state integration suite/, 'Local PostgreSQL mode must reject alternate test paths.'],
  [runner, /verifyIsolationConfig\.cjs/, 'The runner must invoke this static verifier.'],
  [runner, /--config\|--config=/, 'The runner must reject Jest configuration overrides.'],
  [runner, /restricted to the canonical-state integration suite/, 'Local PostgreSQL mode must reject alternate test paths.'],
  [preloader, /DB_OR_PROVIDER_NAME[\s\S]*delete process\.env/, 'Database and provider environment variables must be removed.'],
  [preloader, /looksLikeTestFixture/, 'Explicit child fixtures must be synthetic rather than inherited secrets.'],
  [preloader, /dotenv\.config\s*=/, 'Dotenv loading must be disabled.'],
  [preloader, /net\.Socket\.prototype\.connect/, 'Raw Node socket connections must be guarded.'],
  [preloader, /if \(this\.address\(\)\) remember\(this\)/, 'Assigned local test ports must be registered before Supertest requests.'],
  [preloader, /KONTRA_TEST_ALLOWED_LOCAL_PORTS/, 'Local test ports must be explicitly allowed and inherited allowlists cleared.'],
  [preloader, /globalThis\.fetch/, 'Fetch requests must be guarded.'],
  [preloader, /new URL\(rawUrl\)[\s\S]*loopback\(target\.hostname\)[\s\S]*localPorts\.has\(port\)[\s\S]*allowedTestPorts\(\)\.has\(port\)/, 'Fetch must require a recognized loopback host and a registered or explicitly allowed test-server port.'],
  [preloader, /client\.request\s*=\s*function isolatedRequest/, 'HTTP and HTTPS requests must be guarded.'],
  [preloader, /dgram\.Socket\.prototype\.send/, 'UDP requests must be blocked.'],
  [preloader, /workerThreads\.Worker\s*=\s*class IsolatedWorkerBlocked/, 'Worker threads must not bypass the process network guards.'],
  [auditRedirect, /KONTRA_TEST_ISOLATION !== 'true'[\s\S]*os\.tmpdir\(\)[\s\S]*chmodSync\(isolatedDirectory, 0o700\)[\s\S]*mode: 0o600/, 'Audit-log tests must redirect protected writes into a private temporary directory and file.'],
  [preloader, /Direct PostgreSQL clients are blocked/, 'Direct PostgreSQL clients must fail closed.'],
  [preloader, /blockedNativeDatabaseModules[\s\S]*oracledb[\s\S]*better-sqlite3/, 'Native database client initialization must be blocked.'],
  [preloader, /assertChildAllowed[\s\S]*safeChildOptions/, 'Subprocesses must be allowlisted and receive a sanitized environment.'],
  [mocks, /jest\.mock\('pg'\)[\s\S]*jest\.mock\('@supabase\/supabase-js'\)/, 'Direct PostgreSQL and Supabase imports must use mocks.'],
  [cleanup, /activeLongIntervals[\s\S]*timer\.unref\?\.\(\)/, 'Long test intervals must not keep Jest alive.'],
  [cleanup, /afterAll\([\s\S]*originalClearInterval\(timer\)[\s\S]*activeLongIntervals\.clear\(\)/, 'Long test intervals must be cleared after each test file.'],
  [cleanup, /afterAll\([\s\S]*server\.closeAllConnections\?\.\(\)[\s\S]*server\.close\(/, 'Test HTTP servers and connections must be closed after each test file.'],
  [integration, /mkdtempSync[\s\S]*kontra-canonical-atomicity-[\s\S]*socketDir/, 'The opt-in integration suite must use a temporary local database/socket.'],
  [integration, /KONTRA_CANONICAL_ATOMICITY_PG_TEST\s*===\s*'1'/, 'The integration test itself must remain opt-in.'],
  [integration, /-h ''[\s\S]*'-h', socketDir/, 'The temporary PostgreSQL cluster must disable TCP and use its private socket.'],
  [read('serverStartup.test.js'), /allowLoopbackPort\(port\)/, 'Existing server-startup tests must explicitly allow their local test ports.'],
];

let failed = false;
for (const [source, pattern, message] of checks) {
  if (typeof source !== 'string' || !pattern.test(source)) {
    process.stderr.write(`[test isolation] ${message}\n`);
    failed = true;
  }
}

if (failed) process.exit(1);
process.stdout.write('Static API test-isolation checks passed.\n');
