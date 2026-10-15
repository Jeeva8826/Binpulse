const { WebSocketServer } = require('ws');

let wss = null;

function setupWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Send immediate initial ping
    ws.send(JSON.stringify({
      type: 'INIT_CONNECTED',
      message: 'Connected to BinPulse Real-Time Yard Telemetry Stream',
      timestamp: new Date().toISOString()
    }));

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch (e) {
        // Ignore non-json
      }
    });

    ws.on('error', (err) => {
      // Handle socket error gracefully
    });
  });

  return wss;
}

function broadcast(payload) {
  if (!wss) return;
  const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(msg);
      } catch (err) {
        // Client might have dropped
      }
    }
  }
}

module.exports = {
  setupWebSocket,
  broadcast
};
