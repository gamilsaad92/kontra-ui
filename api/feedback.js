const fs = require('fs');
const path = require('path');

const FEEDBACK_PATH = path.join(__dirname, 'feedbackData.json');

function recordFeedback(entry) {
  let data = [];
  if (fs.existsSync(FEEDBACK_PATH)) {
    try {
      data = JSON.parse(fs.readFileSync(FEEDBACK_PATH, 'utf8'));
    } catch {
      data = [];
    }
  }
  data.push({ ...entry, timestamp: new Date().toISOString() });
  fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(data, null, 2));
}

function retrainModel() {
  // Placeholder for ML/LLM fine-tuning logic
  console.log('✅ Feedback logged. Model update would trigger here.');
}

module.exports = { recordFeedback, retrainModel };
