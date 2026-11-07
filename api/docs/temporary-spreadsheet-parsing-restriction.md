# Temporary Excel workbook parsing restriction

Automated parsing of Excel workbooks (`.xls`, `.xlsx`, `.xlsm`, and `.xlsb`) remains disabled. The vulnerable SheetJS package has been removed from the API dependencies, and no replacement parser has been approved.

The API rejects these workbooks before they reach document parsing or persistence. Detection checks the filename extension and MIME type, plus OLE and ZIP workbook signatures so a renamed workbook or misleading MIME type does not bypass the restriction. The existing upload-size limit is not treated as the mitigation.

PDF, Word, image, CSV, plain-text, and unrelated transaction-room workflows remain available. CSV continues through its plain-text extraction path and does not use SheetJS.

## Future safe-parser migration

Before restoring workbook extraction:

1. Select a maintained parser with an explicit support decision for the currently accepted XLS, XLSX, XLSM, and XLSB formats.
2. Confirm parser maintenance status, advisory state, and resource limits; do not trade one unsupported legacy format for another without product review.
3. Add fixtures for valid workbooks, malformed archives, renamed files, and misleading MIME types.
4. Test the parser under bounded memory/time conditions and verify the existing upload, transaction-record, and role authorization behavior.
5. Restore parsing only after the parser and regression tests pass.
