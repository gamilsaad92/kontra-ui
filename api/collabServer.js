const WebSocket = require('ws');

function attachCollabServer(server) {
  const wss = new WebSocket.Server({ noServer: true });
  const clients = new Map(); // ws -> user

  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/collab') {
      wss.handleUpgrade(req, socket, head, ws => {
        wss.emit('connection', ws, req);
      });
    }
  });

  function broadcast(msg, sender) {
    const data = JSON.stringify(msg);
    for (const [client] of clients) {
      if (client.readyState === WebSocket.OPEN && client !== sender) {
        client.send(data);
      }
    }
  }

  wss.on('connection', ws => {
    ws.on('message', data => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'join') {
          clients.set(ws, msg.user || 'Anonymous');
          broadcast({ type: 'presence', users: Array.from(clients.values()) });
        } else {
          broadcast(msg, ws);
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      broadcast({ type: 'presence', users: Array.from(clients.values()) });
    });
  });
}

module.exports = attachCollabServer;
