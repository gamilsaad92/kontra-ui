const localPostgresIntegration = process.env.KONTRA_TEST_ISOLATION_MODE === 'local-postgres'
  && process.env.KONTRA_CANONICAL_ATOMICITY_PG_TEST === '1';

module.exports = {
  testEnvironment: 'node',
  testMatch: localPostgresIntegration
    ? ['<rootDir>/lib/canonicalStateAtomicity.pg.test.js']
    : ['**/*.test.js'],
  setupFiles: [
    '<rootDir>/testSupport/isolatedApiTestEnv.cjs',
    '<rootDir>/testSupport/redirectAuditLogForTests.cjs',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/testSupport/mockDatabaseClients.cjs',
    '<rootDir>/testSupport/closeTestServers.cjs',
  ],
  testPathIgnorePatterns: localPostgresIntegration
    ? []
    : ['<rootDir>/.*\\.pg\\.test\\.js$'],
};
