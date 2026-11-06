"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const reviewModuleUrl = pathToFileURL(path.join(__dirname, "transactionRecordReview.mjs"));
const dealRoomPagePath = path.join(__dirname, "../pages/public/DealRoomPage.jsx");

test("awaiting field evidence uses recorded document name, excerpt, and page", async () => {
  const { getTransactionRecordEvidence } = await import(reviewModuleUrl);
  assert.deepEqual(
    getTransactionRecordEvidence(
      {
        field_key: "transaction.closing_date",
        source_document_id: "doc-1",
        source_excerpt: "Closing shall occur on October 1.",
        source_page: 14,
      },
      [{ id: "doc-1", filename: "Purchase Agreement.pdf" }],
    ),
    {
      available: true,
      documentId: "doc-1",
      documentName: "Purchase Agreement.pdf",
      excerpt: "Closing shall occur on October 1.",
      page: 14,
    },
  );
});

test("missing source evidence is reported without inventing provenance", async () => {
  const { getTransactionRecordEvidence } = await import(reviewModuleUrl);
  assert.deepEqual(
    getTransactionRecordEvidence({ field_key: "transaction.closing_date" }),
    { available: false, documentId: "", documentName: "", excerpt: "", page: null },
  );
});

test("field confirmation submits with the owner cookie and no legacy token body", async () => {
  const { verifyTransactionRecordField } = await import(reviewModuleUrl);
  let captured;
  const result = await verifyTransactionRecordField({
    apiBase: "https://staging.example/",
    propertyId: "room 1",
    fieldId: "field/1",
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(
    captured.url,
    "https://staging.example/api/public/deal-room/room%201/transaction-record/fields/field%2F1/verify",
  );
  assert.equal(captured.options.credentials, "include");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.body, JSON.stringify({ approveProvenance: false }));
  assert.equal(Object.hasOwn(JSON.parse(captured.options.body), "ownerWriteToken"), false);
});

test("expired and unauthorized owner sessions produce visible authorization errors", async () => {
  const { verifyTransactionRecordField } = await import(reviewModuleUrl);
  for (const [status, message] of [
    [401, /session is unavailable or expired/i],
    [403, /owner approval required/i],
  ]) {
    await assert.rejects(
      verifyTransactionRecordField({
        propertyId: "room-1",
        fieldId: "field-1",
        fetchImpl: async () => ({
          ok: false,
          status,
          json: async () => ({ message: status === 403 ? "Owner approval required." : undefined }),
        }),
      }),
      error => error.status === status && message.test(error.message),
    );
  }
});

test("original document links use the room cookie and the authorized document URL route", async () => {
  const { getOriginalDocumentUrl } = await import(reviewModuleUrl);
  let captured;
  const result = await getOriginalDocumentUrl({
    propertyId: "room-1",
    documentId: "doc/1",
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, status: 200, json: async () => ({ url: "https://storage.example/signed" }) };
    },
  });
  assert.equal(result.url, "https://storage.example/signed");
  assert.equal(captured.url, "/api/public/deal-room/room-1/document/doc%2F1/url");
  assert.equal(captured.options.credentials, "include");
});

test("coordinator record editor is mounted independently of digital-asset readiness", () => {
  const source = fs.readFileSync(dealRoomPagePath, "utf8");
  assert.doesNotMatch(source, /\{\s*digitalAssetEnabled\s*&&\s*<DigitalAssetReadinessSection/);
  assert.match(source, /<DigitalAssetReadinessSection[\s\S]*?focusRequest=\{recordFocus\}/);
  assert.match(source, /digitalAssetEnabled\s*&&\s*allReady/);
});

test("Review record navigation still focuses and scrolls to the record category", () => {
  const source = fs.readFileSync(dealRoomPagePath, "utf8");
  const start = source.indexOf("if (action.type === 'record')");
  const end = source.indexOf("\n    }\n  }, [", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = source.slice(start, end);
  assert.match(handler, /setRecordFocus\(/);
  assert.match(handler, /transaction-record-category-/);
  assert.match(handler, /scrollIntoView/);
});
