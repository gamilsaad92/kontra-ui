const tasks = [];
let processing = false;

function addJob(type, payload = {}) {
  tasks.push({ type, payload });
  setImmediate(processQueue);
}

async function processQueue() {
  if (processing) return;
  processing = true;
  while (tasks.length) {
    const job = tasks.shift();
    try {
      if (job.type === 'score-loans') {
        const result = await require('./edge-functions/predictLoanRisk')();
        logSummary('score-loans', result);
      } else if (job.type === 'score-assets') {
        const result = await require('./edge-functions/predictAssetRisk')();
        logSummary('score-assets', result);
      } else if (job.type === 'score-troubled') {
        const result = await require('./edge-functions/predictTroubledRisk')();
        logSummary('score-troubled', result);
      }
    } catch (err) {
       console.error(`Job ${job.type} processing error:`, err);
    }
  }
  processing = false;
}

function logSummary(type, result) {
  if (!result || typeof result !== 'object') return;
  const analyzed = result.totalAnalyzed ?? result.total ?? 'n/a';
  const alerts =
    result.highRiskAssets || result.highRiskLoans || result.highRiskTroubled || result.alerts || [];
  console.log(
    `[${type}] analyzed ${analyzed} records${alerts.length ? `, ${alerts.length} high risk alerts` : ''}`
  );
}

module.exports = { addJob };
