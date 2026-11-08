'use strict';

const { assertStagingEnvironment } = require('../api/lib/stagingEnvironment');

const staging = assertStagingEnvironment(process.env);
if (!staging.enabled) {
  throw new Error('Refusing to start the staging API without staging isolation');
}

require('../api/index.js');
