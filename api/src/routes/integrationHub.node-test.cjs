'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const express = require('express');
const request = require('supertest');

const aiCalls = { classify: 0, extract: 0 };
const originalLoad = Module._load;
Module._load = function loadIntegrationHubMocks(requested, parent, isMain) {
  if (parent?.filename.endsWith('/src/routes/integrationHub.js')) {
    if (requested === '../../lib/documentIntelligence') {
      return {
        classifyDocument: async () => {
          aiCalls.classify += 1;
          return { doc_type: 'test_document' };
        },
        extractFromDocument: async ({ docType }) => {
          aiCalls.extract += 1;
          return { doc_type: docType, extracted: {}, confidence: 1 };
        },
      };
    }
    if (requested === '@supabase/supabase-js') {
      return {
        createClient: () => ({
          from: () => ({ upsert: async () => ({ error: null }) }),
        }),
      };
    }
  }
  return originalLoad.call(this, requested, parent, isMain);
};

let integrationHubRouter;
try {
  integrationHubRouter = require('./integrationHub');
} finally {
  Module._load = originalLoad;
}

const app = express();
app.use(express.json());
app.use('/api/integration', integrationHubRouter);

const endpoints = ['/classify', '/extract', '/csv-preview'];
const oleWorkbook = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.from('Workbook', 'utf16le'),
]);
const xlsxWorkbook = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from('xl/workbook.xml'),
]);
const xlsbWorkbook = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from('xl/workbook.bin'),
]);

test('all integration upload routes reject workbook extensions before processing', async () => {
  for (const endpoint of endpoints) {
    const response = await request(app)
      .post(`/api/integration${endpoint}`)
      .attach('file', Buffer.from('workbook'), {
        filename: 'financials.xlsb',
        contentType: 'application/octet-stream',
      });
    assert.equal(response.status, 415, endpoint);
    assert.equal(response.body.code, 'SPREADSHEET_PARSING_TEMPORARILY_DISABLED', endpoint);
  }
  assert.deepEqual(aiCalls, { classify: 0, extract: 0 });
});

test('renamed OLE and ZIP workbooks with misleading MIME types are rejected', async () => {
  for (const endpoint of endpoints) {
    for (const [buffer, filename, contentType] of [
      [oleWorkbook, 'report.pdf', 'application/pdf'],
      [xlsxWorkbook, 'report.txt', 'text/plain'],
      [xlsbWorkbook, 'report.pdf', 'application/pdf'],
    ]) {
      const response = await request(app)
        .post(`/api/integration${endpoint}`)
        .attach('file', buffer, { filename, contentType });
      assert.equal(response.status, 415, `${endpoint} ${filename}`);
      assert.equal(response.body.code, 'SPREADSHEET_PARSING_TEMPORARILY_DISABLED');
    }
  }
  assert.deepEqual(aiCalls, { classify: 0, extract: 0 });
});

test('supported CSV, PDF, Word, and image uploads still reach their handlers', async () => {
  const csv = await request(app)
    .post('/api/integration/csv-preview')
    .attach('file', Buffer.from('borrower,upb\nExample,250000'), {
      filename: 'loans.csv',
      contentType: 'text/csv',
    });
  assert.equal(csv.status, 200);
  assert.deepEqual(csv.body.headers, ['borrower', 'upb']);

  const pdf = await request(app)
    .post('/api/integration/classify')
    .attach('file', Buffer.from('%PDF-1.7 supported input'), {
      filename: 'report.pdf',
      contentType: 'application/pdf',
    });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.body.doc_type, 'test_document');

  const word = await request(app)
    .post('/api/integration/extract')
    .field('doc_type', 'insurance')
    .attach('file', Buffer.from('legacy Word text'), {
      filename: 'report.doc',
      contentType: 'application/msword',
    });
  assert.equal(word.status, 200);

  const image = await request(app)
    .post('/api/integration/extract')
    .field('doc_type', 'insurance')
    .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
      filename: 'photo.png',
      contentType: 'image/png',
    });
  assert.equal(image.status, 200);
  assert.equal(aiCalls.classify, 1);
  assert.equal(aiCalls.extract, 2);
});
