const scanLoanAnomalies = require('../edge-functions/scanLoanAnomalies');

scanLoanAnomalies()
  .then(() => console.log('Loan anomaly scan complete'))
  .catch(err => {
    console.error('Loan anomaly job failed', err);
    process.exit(1);
  });
