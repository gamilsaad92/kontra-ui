const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'userActivity.json');

function readData() {
  if (!fs.existsSync(DATA_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function logUserEvent(userId, event) {
  if (!userId || !event) return;
  const data = readData();
  if (!Array.isArray(data[userId])) data[userId] = [];
  data[userId].push({ event, ts: new Date().toISOString() });
  writeData(data);
}

async function suggestNextFeature(userId, openai) {
  const data = readData();
  const events = data[userId] || [];
  if (!events.length) {
    return 'Explore the dashboard to get started.';
  }
  if (openai) {
    try {
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You suggest the next best action for a user based on recent events.'
          },
          { role: 'user', content: JSON.stringify(events.slice(-10)) }
        ]
      });
      return resp.choices[0].message.content.trim();
    } catch (err) {
      console.error('Personalization AI error:', err);
    }
  }
  const counts = events.slice(-20).reduce((acc, e) => {
    acc[e.event] = (acc[e.event] || 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return 'Keep exploring the app.';
  if (top[0].includes('loan')) return 'Check your loan reports for new insights.';
  if (top[0].includes('dashboard')) return 'Customize your dashboard layout.';
  return 'Continue with your next task in the app.';
}

module.exports = { logUserEvent, suggestNextFeature };
