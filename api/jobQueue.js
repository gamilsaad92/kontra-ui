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
        await require('./edge-functions/predictLoanRisk')();
      } else if (job.type === 'score-assets') {
        await require('./edge-functions/predictAssetRisk')();
      } else if (job.type === 'score-troubled') {
        await require('./edge-functions/predictTroubledRisk')();
      }
    } catch (err) {
       console.error(`Job ${job.type} processing error:`, err);
    }
  }
  processing = false;
}

module.exports = { addJob };
