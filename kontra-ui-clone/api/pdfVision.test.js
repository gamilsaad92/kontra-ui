const PDFDocument = require('pdfkit');
const {
  renderPdfPagesForVision,
  DEFAULT_MAX_PAGES,
} = require('./lib/pdfVision');

function makePdf(pageCount) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ autoFirstPage: false });
    const chunks = [];
    document.on('data', chunk => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    for (let page = 0; page < pageCount; page += 1) {
      document.addPage();
      document.fontSize(18).text(`Page ${page + 1}`);
    }
    document.end();
  });
}

describe('scanned PDF vision preparation', () => {
  test('renders every page in a bounded PDF', async () => {
    const pdf = await makePdf(5);
    const result = renderPdfPagesForVision(pdf, { maxPages: 5 });

    expect(result.pageCount).toBe(5);
    expect(result.images).toHaveLength(5);
    expect(result.images.every(image => image.image_url.url.startsWith('data:image/png;base64,'))).toBe(true);
  });

  test('rejects a PDF that exceeds the page budget instead of truncating it', async () => {
    const pdf = await makePdf(2);

    expect(() => renderPdfPagesForVision(pdf, { maxPages: 1 })).toThrow('exceeding the 1-page');
  });

  test('rejects input larger than the byte budget before rendering', () => {
    expect(() => renderPdfPagesForVision(Buffer.alloc(32), { maxBytes: 16 }))
      .toThrow('size limit');
    expect(DEFAULT_MAX_PAGES).toBeGreaterThan(4);
  });
});