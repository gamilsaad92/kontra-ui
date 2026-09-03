const zlib = require('zlib');

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const MAX_XML_BYTES = 8 * 1024 * 1024;

function findEndOfCentralDirectory(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

function readZipEntry(buffer, targetName) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) return null;
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) return null;

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > buffer.length) return null;

  let offset = centralDirectoryOffset;
  while (offset + 46 <= centralDirectoryEnd
    && buffer.readUInt32LE(offset) === CENTRAL_DIRECTORY_SIGNATURE) {
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const filenameStart = offset + 46;
    const filename = buffer.subarray(filenameStart, filenameStart + filenameLength).toString('utf8');

    if (filename === targetName) {
      if (uncompressedSize > MAX_XML_BYTES
        || localHeaderOffset + 30 > buffer.length
        || buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_SIGNATURE) {
        return null;
      }

      const localFilenameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localFilenameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > buffer.length) return null;

      const compressed = buffer.subarray(dataStart, dataEnd);
      if (compressionMethod === 0) return compressed;
      if (compressionMethod === 8) return zlib.inflateRawSync(compressed);
      return null;
    }

    offset += 46 + filenameLength + extraLength + commentLength;
  }

  return null;
}

function decodeXmlEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_match, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractDocxText(buffer) {
  const xmlBuffer = readZipEntry(buffer, 'word/document.xml');
  if (!xmlBuffer) return '';

  const xml = xmlBuffer.toString('utf8');
  return xml
    .replace(/<w:(?:tab)\b[^>]*\/>/g, '\t')
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
    .replace(/<\/w:tc>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:(?:t|delText)\b[^>]*>([\s\S]*?)<\/w:(?:t|delText)>/g, (_match, value) => decodeXmlEntities(value))
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = {
  extractDocxText,
};