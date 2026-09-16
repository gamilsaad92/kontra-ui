const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
const DEFAULT_MAX_PAGES = 40;
const DEFAULT_MAX_RENDERED_BYTES = 32 * 1024 * 1024;

function pdfError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getPageCount(pdfPath) {
  let info;
  try {
    info = execFileSync('pdfinfo', [pdfPath], { timeout: 10_000, encoding: 'utf8' });
  } catch (error) {
    throw pdfError('PDF_PAGE_COUNT_UNAVAILABLE', 'Could not determine the PDF page count');
  }
  const match = String(info).match(/^Pages:\s*(\d+)/im);
  const pageCount = Number(match?.[1]);
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw pdfError('PDF_PAGE_COUNT_UNAVAILABLE', 'Could not determine the PDF page count');
  }
  return pageCount;
}

function numericPageSort(left, right) {
  const leftNumber = Number((left.match(/-(\d+)\.png$/) || [0, 0])[1]);
  const rightNumber = Number((right.match(/-(\d+)\.png$/) || [0, 0])[1]);
  return leftNumber - rightNumber;
}

/**
 * Render every page of a bounded scanned PDF. The function rejects PDFs that
 * exceed the page/size budget instead of silently analyzing a partial file.
 */
function renderPdfPagesForVision(buffer, {
  maxBytes = DEFAULT_MAX_BYTES,
  maxPages = DEFAULT_MAX_PAGES,
  maxRenderedBytes = DEFAULT_MAX_RENDERED_BYTES,
} = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw pdfError('PDF_EMPTY', 'The PDF is empty');
  }
  if (buffer.length > maxBytes) {
    throw pdfError('PDF_TOO_LARGE_FOR_VISION', 'The scanned PDF exceeds the image-analysis size limit');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kontra-pdf-'));
  const pdfPath = path.join(tempDir, 'document.pdf');
  const imageBase = path.join(tempDir, 'page');

  try {
    fs.writeFileSync(pdfPath, buffer);
    const pageCount = getPageCount(pdfPath);
    if (pageCount > maxPages) {
      throw pdfError(
        'PDF_PAGE_LIMIT_EXCEEDED',
        `The scanned PDF has ${pageCount} pages, exceeding the ${maxPages}-page image-analysis limit`,
      );
    }

    execFileSync('pdftoppm', [
      '-r', '150',
      '-png',
      '-f', '1',
      '-l', String(pageCount),
      pdfPath,
      imageBase,
    ], { timeout: Math.max(30_000, pageCount * 2_000) });

    const pngs = fs.readdirSync(tempDir)
      .filter(file => file.endsWith('.png'))
      .sort(numericPageSort);
    if (pngs.length !== pageCount) {
      throw pdfError('PDF_PAGE_RENDER_INCOMPLETE', 'The scanned PDF could not be rendered completely');
    }

    const renderedBytes = pngs.reduce((sum, file) => sum + fs.statSync(path.join(tempDir, file)).size, 0);
    if (renderedBytes > maxRenderedBytes) {
      throw pdfError('PDF_RENDER_TOO_LARGE', 'The rendered scanned PDF exceeds the image-analysis size limit');
    }

    return {
      pageCount,
      images: pngs.map(file => ({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${fs.readFileSync(path.join(tempDir, file)).toString('base64')}`,
          detail: 'high',
        },
      })),
    };
  } catch (error) {
    if (error?.code) throw error;
    throw pdfError('PDF_VISION_FAILED', 'The scanned PDF could not be prepared for image analysis');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_PAGES,
  DEFAULT_MAX_RENDERED_BYTES,
  renderPdfPagesForVision,
};