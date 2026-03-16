const predictLoanRisk = require('../edge-functions/predictLoanRisk');

predictLoanRisk()
  .then(() => console.log('Loan risk scoring complete'))
  .catch(err => {
    console.error('Loan risk scoring job failed', err);
    process.exit(1);
  });
