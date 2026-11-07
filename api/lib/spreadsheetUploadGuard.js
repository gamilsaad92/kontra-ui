const EXCEL_EXTENSIONS = new Set(['xls', 'xlsx', 'xlsm', 'xlsb']);
const OLE_COMPOUND_FILE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_LOCAL_FILE_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE_WORD_DOCUMENT_STREAM = Buffer.from('WordDocument', 'utf16le');
const OLE_EXCEL_WORKBOOK_STREAMS = [
  Buffer.from('Workbook', 'utf16le'),
  Buffer.from('workbook', 'utf16le'),
  Buffer.from('WORKBOOK', 'utf16le'),
  Buffer.from('Book', 'utf16le'),
  Buffer.from('BOOK', 'utf16le'),
];
const EXCEL_WORKBOOK_ENTRIES = [
  Buffer.from('xl/workbook.xml'),
  Buffer.from('xl/workbook.bin'),
];

const SPREADSHEET_PARSING_DISABLED_MESSAGE =
  'Automated Excel workbook parsing is temporarily unavailable. You can still upload PDF, Word, image, CSV, or plain-text documents.';

function isExcelWorkbookUpload(file = {}) {
  const name = String(file.originalname || file.filename || '');
  const extension = name.split(/[\\/]/).pop().split('.').pop().toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.alloc(0);

  if (EXCEL_EXTENSIONS.has(extension)) return true;
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('ms-excel')) return true;
  if (buffer.length >= OLE_COMPOUND_FILE_SIGNATURE.length
    && buffer.subarray(0, OLE_COMPOUND_FILE_SIGNATURE.length).equals(OLE_COMPOUND_FILE_SIGNATURE)) {
    if (buffer.includes(OLE_WORD_DOCUMENT_STREAM)) return false;
    return OLE_EXCEL_WORKBOOK_STREAMS.some((streamName) => buffer.includes(streamName));
  }

  const isZip = buffer.length >= ZIP_LOCAL_FILE_SIGNATURE.length
    && buffer.subarray(0, ZIP_LOCAL_FILE_SIGNATURE.length).equals(ZIP_LOCAL_FILE_SIGNATURE);
  return isZip && EXCEL_WORKBOOK_ENTRIES.some((entry) => buffer.includes(entry));
}

function rejectSpreadsheetParsing(req, res, next) {
  if (!isExcelWorkbookUpload(req.file)) return next();
  return res.status(415).json({
    code: 'SPREADSHEET_PARSING_TEMPORARILY_DISABLED',
    error: SPREADSHEET_PARSING_DISABLED_MESSAGE,
  });
}

module.exports = {
  isExcelWorkbookUpload,
  rejectSpreadsheetParsing,
  SPREADSHEET_PARSING_DISABLED_MESSAGE,
};
