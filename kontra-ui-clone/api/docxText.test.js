const { extractDocxText } = require('./lib/docxText');

const COMPRESSED_DOCX_FIXTURE = Buffer.from(
  'UEsDBBQAAAAIAIUMI13TPDzjAAEAALEBAAARAAAAd29yZC9kb2N1bWVudC54bWyNkMFOwzAMhu97iihCO40mTDCNru1OcAWh8QBeErpITRzZYaVvTwpCSAgJLn8UJ/7+3272b2EQZ0fsMbbyqtJSuGjQ+ti38vlwf7mVgjNECwNG18rJsdx3i2asLZrX4GIWhRC5Hlt5yjnVSrE5uQBcYXKxvL0gBcjlSr0akWwiNI65GIRBrbXeqAA+yq4gj2in+Uyz0Cy5e3IJPIk7zr5gXKPm4qz0oenn/wNmGAR9dhnkXIuL283qeqsrrf/sfqSSmvIkLATonUg4eDOJwQc/g9arG61XWv+L9TBGR0tIyDsWkMrc55JsCSHtSrCYCUxGEmyK5S8w9bUP9b3rbvEOUEsBAh4DFAAAAAgAhQwjXdM8POMAAQAAsQEAABEAAAAAAAAAAQAAAKSBAAAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAABAAEAPwAAAC8BAAAAAA==',
  'base64',
);

describe('DOCX text extraction', () => {
  test('extracts paragraph text and XML entities from a compressed DOCX', () => {
    const text = extractDocxText(COMPRESSED_DOCX_FIXTURE);

    expect(text).toContain('Repair Estimate');
    expect(text).toContain('Total repair cost: $96,480.00');
    expect(text).toContain('Property damage policy limit: $2,500,000.00');
    expect(text).toContain("Owner's approval & contractor scope");
    expect(text).toMatch(/Repair Estimate\nTotal repair cost/);
  });

  test('does not treat an invalid binary buffer as document text', () => {
    expect(extractDocxText(Buffer.from('not a DOCX'))).toBe('');
  });
});