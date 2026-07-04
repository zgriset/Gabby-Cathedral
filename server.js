// ─────────────────────────────────────────────────────────────────────────────
// Cathedral — Online Play Server (serves the game AND relays moves)
//
// This single Node service does two jobs on ONE port:
//   1. Serves the game page (cathedral.html) over HTTP/HTTPS.
//   2. Relays moves between the two players over WebSocket (same origin, so the
//      browser can use ws:// or wss:// automatically with no config).
//
// Because the page and the socket share an origin, players never have to type a
// server address — the game connects back to wherever it was loaded from.
//
// ─── RUN LOCALLY ─────────────────────────────────────────────────────────────
//   npm install          # installs the one dependency (ws)
//   node server.js       # then open http://localhost:8090/
//
// ─── DEPLOY (Render.com, free) ───────────────────────────────────────────────
//   Push this folder to a GitHub repo, create a Render "Web Service" from it:
//     Build command:  npm install
//     Start command:  node server.js
//   Render sets process.env.PORT automatically. Add your custom domain in the
//   Render dashboard (see README for the GoDaddy DNS steps).
// ─────────────────────────────────────────────────────────────────────────────

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8090;

// ─── HTTP: serve the static game files ───────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Health check / default → the game page
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/cathedral.html';

  // Prevent path traversal; only serve files from this directory
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// ─── WebSocket: relay moves between paired players ───────────────────────────
// Attach the WS server to the same HTTP server so they share the port/origin.
const wss = new WebSocketServer({ server });

// rooms: code -> { players: [ws, ...], sides: Map<ws, 1|2> }
const rooms = new Map();

function send(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}
function otherPlayer(room, ws) {
  return room.players.find(p => p !== ws);
}

wss.on('connection', (ws) => {
  ws.room = null;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    // ── Join or create a room ────────────────────────────────────────────────
    if (msg.type === 'host' || msg.type === 'join') {
      const code = (msg.room || '').toUpperCase().trim();
      if (!code) return;

      let room = rooms.get(code);
      if (!room) {
        room = { players: [], sides: new Map() };
        rooms.set(code, room);
      }
      if (room.players.length >= 2) { send(ws, { type: 'full' }); return; }

      // First player in the room is Light (1), second is Dark (2).
      const side = room.players.length === 0 ? 1 : 2;
      room.players.push(ws);
      room.sides.set(ws, side);
      ws.room = code;

      send(ws, { type: 'joined', room: code, side });

      if (room.players.length === 2) {
        room.players.forEach(p => send(p, { type: 'start' }));
      }
      return;
    }

    // ── Relay gameplay messages to the opponent ──────────────────────────────
    if (!ws.room) return;
    const room = rooms.get(ws.room);
    if (!room) return;
    const opponent = otherPlayer(room, ws);
    if (msg.type === 'move' || msg.type === 'capture') send(opponent, msg);
  });

  ws.on('close', () => {
    const code = ws.room;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    const opponent = otherPlayer(room, ws);
    send(opponent, { type: 'opponent-left' });
    rooms.delete(code); // free the code for reuse
  });
});

server.listen(PORT, () => {
  console.log(`Cathedral server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT}/  (locally) to play.`);
});
