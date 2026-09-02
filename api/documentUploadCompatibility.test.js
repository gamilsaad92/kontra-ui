const router = require('./routers/aiDealReview');

describe('AI document upload compatibility', () => {
  test('keeps hashes and processing state when only active-version columns are unavailable', () => {
    const payloads = router.buildDocumentVersionInsertPayloads({
      propertyId: 'generated-room',
      section: 'insurance_claim_documentation',
      filename: 'claim.pdf',
      analysis: { summary: 'received' },
      role: 'coordinator',
      storagePath: 'generated-room/claim.pdf',
      sourceHash: 'hash-1',
    });

    expect(payloads[0]).toEqual(expect.objectContaining({
      source_hash: 'hash-1',
      processing_status: 'extracted',
      is_active: true,
    }));
    expect(payloads[1]).toEqual(expect.objectContaining({
      source_hash: 'hash-1',
      processing_status: 'extracted',
    }));
    expect(payloads[1]).not.toHaveProperty('is_active');
    expect(payloads[3]).not.toHaveProperty('source_hash');
  });
});