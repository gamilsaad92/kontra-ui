'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTaskSubmissions, isMissingSubmissionStatus } = require('./taskSubmissionQuery');

function createClient(results) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, 'party_submissions');
      return {
        select(columns) {
          calls.push({ columns });
          return {
            eq(column, value) {
              assert.equal(column, 'property_id');
              calls[calls.length - 1].propertyId = value;
              const result = results.shift();
              return Promise.resolve(result);
            },
          };
        },
      };
    },
  };
}

test('retries task submission query without status only when the column is absent', async () => {
  const rows = [{ role: 'lender', email: 'redacted@example.invalid', name: 'test', doc_count: 1, submitted_at: null }];
  const client = createClient([
    { data: null, error: { code: '42703', message: 'column party_submissions.status does not exist' } },
    { data: rows, error: null },
  ]);

  const result = await loadTaskSubmissions(client, 'test-room');

  assert.deepEqual(result, { data: rows, error: null });
  assert.deepEqual(client.calls, [
    { columns: 'role, email, name, status, doc_count, submitted_at', propertyId: 'test-room' },
    { columns: 'role, email, name, doc_count, submitted_at', propertyId: 'test-room' },
  ]);
});

test('does not retry for unrelated query errors', async () => {
  const error = { code: '42501', message: 'permission denied' };
  const client = createClient([{ data: null, error }]);

  const result = await loadTaskSubmissions(client, 'test-room');

  assert.equal(result.error, error);
  assert.equal(client.calls.length, 1);
});

test('recognizes PostgREST schema-cache errors for the missing status field', () => {
  assert.equal(isMissingSubmissionStatus({
    code: 'PGRST204',
    message: "Could not find the 'status' column of 'party_submissions' in the schema cache",
  }), true);
  assert.equal(isMissingSubmissionStatus({
    code: 'PGRST204',
    message: "Could not find the 'email' column of 'party_submissions' in the schema cache",
  }), false);
});
