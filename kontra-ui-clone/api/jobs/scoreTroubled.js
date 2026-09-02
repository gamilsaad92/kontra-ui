const predictTroubledRisk = require('../edge-functions/predictTroubledRisk');

predictTroubledRisk()
  .then(() => console.log('Troubled asset risk scoring complete'))
  .catch(err => {
    console.error('Troubled asset risk job failed', err);
    process.exit(1);
  });
