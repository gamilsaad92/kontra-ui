'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

class ApiBaselineReporter {
  onRunComplete(_contexts, result) {
    const outputPath = process.env.API_JEST_RESULT_FILE;
    if (!outputPath) throw new Error('API_JEST_RESULT_FILE is required for baseline comparison');
    const requiredMetadata = [
      'API_JEST_SOURCE_COMMIT',
      'API_JEST_BASE_COMMIT',
      'API_JEST_RUN_ID',
      'API_JEST_COMMAND',
      'API_JEST_NPM_VERSION',
    ];
    for (const name of requiredMetadata) {
      if (!process.env[name]) throw new Error(`${name} is required for baseline comparison`);
    }
    const testResults = (result.testResults || []).map(suite => ({
      testFilePath: suite.testFilePath,
      status: suite.numFailingTests > 0 || suite.testExecError ? 'failed' : 'passed',
      assertionResults: (suite.testResults || []).map(test => ({
        status: test.status,
        ancestorTitles: test.ancestorTitles || [],
        title: test.title || '',
      })),
    }));
    const results = {
      startTime: result.startTime,
      wasInterrupted: result.wasInterrupted,
      numTotalTestSuites: result.numTotalTestSuites,
      numFailedTests: result.numFailedTests,
      numFailedTestSuites: result.numFailedTestSuites,
      testResults,
    };
    const resultJson = JSON.stringify(results);
    fs.writeFileSync(outputPath, resultJson);
    const metadata = {
      sourceCommit: process.env.API_JEST_SOURCE_COMMIT,
      baseCommit: process.env.API_JEST_BASE_COMMIT,
      runId: process.env.API_JEST_RUN_ID,
      testCommand: process.env.API_JEST_COMMAND,
      nodeVersion: process.version,
      npmVersion: process.env.API_JEST_NPM_VERSION,
      lockfileSha256: crypto.createHash('sha256')
        .update(fs.readFileSync(path.resolve(process.cwd(), 'package-lock.json')))
        .digest('hex'),
      resultSha256: crypto.createHash('sha256').update(resultJson).digest('hex'),
      suiteCount: testResults.length,
      startedAt: result.startTime,
      finishedAt: Date.now(),
      wasInterrupted: result.wasInterrupted,
    };
    fs.writeFileSync(`${outputPath}.meta.json`, JSON.stringify(metadata));
  }
}

module.exports = ApiBaselineReporter;
