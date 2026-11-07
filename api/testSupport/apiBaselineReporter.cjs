'use strict';

const fs = require('node:fs');

class ApiBaselineReporter {
  onRunComplete(_contexts, result) {
    const outputPath = process.env.API_JEST_RESULT_FILE;
    if (!outputPath) throw new Error('API_JEST_RESULT_FILE is required for baseline comparison');
    const testResults = (result.testResults || []).map(suite => ({
      testFilePath: suite.testFilePath,
      status: suite.numFailingTests > 0 || suite.testExecError ? 'failed' : 'passed',
      assertionResults: (suite.testResults || []).map(test => ({
        status: test.status,
        ancestorTitles: test.ancestorTitles || [],
        title: test.title || '',
      })),
    }));
    fs.writeFileSync(outputPath, JSON.stringify({
      numFailedTests: result.numFailedTests,
      numFailedTestSuites: result.numFailedTestSuites,
      testResults,
    }));
  }
}

module.exports = ApiBaselineReporter;
