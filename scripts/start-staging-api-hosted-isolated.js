'use strict';

const { assertStagingEnvironment } = require('../api/lib/stagingEnvironment');

const staging = assertStagingEnvironment(process.env);
if (!staging.enabled) {
  throw new Error('Refusing to start the staging API without staging isolation');
}

const api = require('../api/index.js');
if (typeof api.startServer !== 'function') {
  throw new Error('API startup function is unavailable');
}

api.startServer().catch((error) => {
  console.error(`FATAL: API startup refused: ${error.message}`);
  process.exitCode = 1;
});
