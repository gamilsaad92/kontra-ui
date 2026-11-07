const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isExcelWorkbookUpload,
  rejectSpreadsheetParsing,
  SPREADSHEET_PARSING_DISABLED_MESSAGE,
} = require('./spreadsheetUploadGuard');

function runGuard(file) {
  const response = {};
  let nextCalled = false;
  const res = {
    status(status) {
      response.status = status;
      return this;
    },
    json(body) {
      response.body = body;
      return this;
    },
  };

  rejectSpreadsheetParsing({ file }, res, () => {
    nextCalled = true;
  });

  return { response, nextCalled };
}

test('workbook extensions are rejected before an upload handler runs', () => {
  const file = { originalname: 'model.xlsx', mimetype: 'application/octet-stream' };
  assert.equal(isExcelWorkbookUpload(file), true);
  const { response, nextCalled } = runGuard(file);
  assert.equal(nextCalled, false);
  assert.equal(response.status, 415);
  assert.equal(response.body.code, 'SPREADSHEET_PARSING_TEMPORARILY_DISABLED');
  assert.equal(response.body.error, SPREADSHEET_PARSING_DISABLED_MESSAGE);
});

test('spreadsheet MIME types are rejected even with a different extension', () => {
  const { response, nextCalled } = runGuard({
    originalname: 'model.bin',
    mimetype: 'application/vnd.ms-excel',
  });
  assert.equal(nextCalled, false);
  assert.equal(response.status, 415);
});

test('renamed legacy workbooks are rejected by their OLE signature and misleading MIME', () => {
  const { response, nextCalled } = runGuard({
    originalname: 'report.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.from('Workbook', 'utf16le'),
    ]),
  });
  assert.equal(nextCalled, false);
  assert.equal(response.status, 415);
});

test('renamed XLSX and XLSB files are rejected by workbook entries and misleading MIME', () => {
  for (const workbookEntry of ['xl/workbook.xml', 'xl/workbook.bin']) {
    const { response, nextCalled } = runGuard({
      originalname: 'report.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from(workbookEntry),
      ]),
    });
    assert.equal(isExcelWorkbookUpload({
      originalname: 'report.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from(workbookEntry),
      ]),
    }), true);
    assert.equal(nextCalled, false);
    assert.equal(response.status, 415);
  }
});

test('supported PDF, Word, CSV, and image uploads remain available', () => {
  const supportedFiles = [
    { originalname: 'report.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7') },
    {
      originalname: 'legacy-word.doc',
      mimetype: 'application/msword',
      buffer: Buffer.concat([
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
        Buffer.from('WordDocument', 'utf16le'),
      ]),
    },
    {
      originalname: 'report.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('word/document.xml')]),
    },
    { originalname: 'report.csv', mimetype: 'text/csv', buffer: Buffer.from('amount,date\\n10,2026-01-01') },
    { originalname: 'photo.png', mimetype: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  ];

  for (const file of supportedFiles) {
    const { response, nextCalled } = runGuard(file);
    assert.equal(isExcelWorkbookUpload(file), false);
    assert.equal(nextCalled, true);
    assert.equal(response.status, undefined);
  }
});
