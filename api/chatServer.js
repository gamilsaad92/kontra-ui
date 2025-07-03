const http = require('http');
const WebSocket = require('ws');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askAssistant(question) {
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are Kontra AI, a customer care assistant for loan servicing.' },
      { role: 'user', content: question }
    ]
  });
  return resp.choices[0].message.content || '';
}

function attachChatServer(server) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/chat') {
      wss.handleUpgrade(req, socket, head, ws => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', ws => {
    ws.on('message', async data => {
      const text = data.toString().trim();
      if (!text) return;
      try {
        const reply = await askAssistant(text);
        ws.send(JSON.stringify({ role: 'assistant', content: reply }));
      } catch (err) {
        ws.send(JSON.stringify({ role: 'assistant', content: 'Error: ' + err.message }));
      }
    });
  });
}

module.exports = attachChatServer;
