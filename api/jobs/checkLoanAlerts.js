const checkLoanAlerts = require('../edge-functions/checkLoanAlerts');

checkLoanAlerts()
  .then(() => console.log('Loan alert job complete'))
  .catch(err => {
    console.error('Loan alert job failed', err);
    process.exit(1);
  });
