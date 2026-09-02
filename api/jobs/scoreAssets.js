const predictAssetRisk = require('../edge-functions/predictAssetRisk');

predictAssetRisk()
  .then(() => console.log('Risk scoring complete'))
  .catch(err => {
    console.error('Risk scoring job failed', err);
    process.exit(1);
  });
