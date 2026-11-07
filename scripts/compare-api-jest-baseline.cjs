#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

function readResults(file) {
  if (!file || !fs.existsSync(file)) {
    throw new Error(`Jest result file is missing: ${file || '(unset)'}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizePath(file) {
  const marker = '/api/';
  const index = file.lastIndexOf(marker);
  return index >= 0 ? file.slice(index + marker.length) : file;
}

function failingCases(results) {
  const failures = new Set();
  for (const suite of results.testResults || []) {
    const file = normalizePath(suite.testFilePath || 'unknown-suite');
    const failed = (suite.assertionResults || []).filter(test => test.status === 'failed');
    for (const test of failed) {
      const title = [...(test.ancestorTitles || []), test.title].filter(Boolean).join(' › ');
      failures.add(`${file} :: ${title || '(unnamed failing test)'}`);
    }
    if (suite.status === 'failed' && failed.length === 0) {
      failures.add(`${file} :: (suite-level failure)`);
    }
  }
  return failures;
}

try {
  const baseline = readResults(process.argv[2]);
  const pullRequest = readResults(process.argv[3]);
  const baselineFailures = failingCases(baseline);
  const prFailures = failingCases(pullRequest);
  const newFailures = [...prFailures].filter(name => !baselineFailures.has(name)).sort();
  const summary = [
    '## API baseline comparison',
    `- Preparation baseline: ${baseline.numFailedTests || 0} failed tests across ${baseline.numFailedTestSuites || 0} failed suites.`,
    `- Pull request: ${pullRequest.numFailedTests || 0} failed tests across ${pullRequest.numFailedTestSuites || 0} failed suites.`,
    `- PR-only failing tests: ${newFailures.length}.`,
    ...(newFailures.length ? newFailures.map(name => `  - ${name}`) : ['- No new failing tests compared with the unchanged preparation base.']),
  ].join('\n');
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
  if (newFailures.length) process.exitCode = 1;
} catch (error) {
  console.error(`API baseline comparison failed: ${error.message}`);
  process.exitCode = 1;
}
