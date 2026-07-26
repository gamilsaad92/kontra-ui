/**
 * Verification engine stub.
 * Triggered after document uploads; full AI-powered verification is handled
 * inside the Verified Asset Package flow (verifiedAssetPackage.js).
 */

async function runVerification(propertyId, packId) {
  // No-op stub — VAP generation in verifiedAssetPackage.js covers verification.
  return { propertyId, packId, status: 'skipped' };
}

module.exports = { runVerification };
