const WebSocket = require('ws');
let wss;

function attachCollabServer(server) {
 wss = new WebSocket.Server({ noServer: true });
  const clients = new Map(); // ws -> user

  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/collab') {
      wss.handleUpgrade(req, socket, head, ws => {
        wss.emit('connection', ws, req);
      });
    }
  });

   function broadcastInternal(msg, sender) {
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
         broadcastInternal({ type: 'presence', users: Array.from(clients.values()) });
        } else {
            broadcastInternal(msg, ws);
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
        broadcastInternal({ type: 'presence', users: Array.from(clients.values()) });
    });
  });
}

// Broadcast arbitrary messages to all connected clients. Used for emitting
// server-side events like trade updates.
function broadcast(msg) {
  if (!wss) return;
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

module.exports = attachCollabServer;
module.exports.broadcast = broadcast;
