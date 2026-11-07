// Pact Maker host: serves the built app (dist/) and relays WebSocket messages.
// The relay never reads game data. The host's browser is the authority.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 3000;
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ---------- static files ----------
const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    res.writeHead(400);
    return res.end();
  }

  let file = path.join(DIST, urlPath);
  const rel = path.relative(DIST, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(403);
    return res.end();
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('No dist/ folder yet. Run: npm run build');
  }

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
});

// ---------- relay ----------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 512 * 1024 });
/** room code -> { host: WebSocket, peers: Map<id, WebSocket> } */
const rooms = new Map();
let nextId = 1;

const send = (ws, obj) => {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
};

wss.on('connection', (ws) => {
  let room = null;
  let role = null; // 'host' | 'peer'
  let id = null;

  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!m || typeof m.t !== 'string') return;

    // First message must be host or join.
    if (!role) {
      const code = typeof m.room === 'string' ? m.room.trim().toUpperCase().slice(0, 12) : '';
      if (!code) return send(ws, { t: 'error', reason: 'Missing room code' });

      if (m.t === 'host') {
        if (rooms.has(code)) return send(ws, { t: 'error', reason: 'Room already hosted' });
        rooms.set(code, { host: ws, peers: new Map() });
        room = code;
        role = 'host';
        return send(ws, { t: 'hosting', room: code });
      }

      if (m.t === 'join') {
        const r = rooms.get(code);
        if (!r) return send(ws, { t: 'error', reason: 'Room not found' });
        const name =
          String(m.name ?? '')
            .trim()
            .slice(0, 40) || 'Player';
        id = String(nextId++);
        r.peers.set(id, ws);
        room = code;
        role = 'peer';
        send(ws, { t: 'joined', id });
        return send(r.host, { t: 'peer-join', id, name });
      }
      return;
    }

    const r = rooms.get(room);
    if (!r) return;

    if (role === 'host') {
      const target = r.peers.get(String(m.id));
      if (!target) return;
      if (m.t === 'to') send(target, { t: 'msg', data: m.data });
      else if (m.t === 'kick') {
        send(target, { t: 'closed', reason: 'Removed by host' });
        target.close();
      }
    } else if (m.t === 'msg') {
      // The id comes from the server, so players cannot pretend to be someone else.
      send(r.host, { t: 'peer-msg', id, data: m.data });
    }
  });

  ws.on('close', () => {
    const r = rooms.get(room);
    if (!r) return;
    if (role === 'host') {
      for (const p of r.peers.values()) {
        send(p, { t: 'closed', reason: 'Host left' });
        p.close();
      }
      rooms.delete(room);
    } else if (role === 'peer') {
      r.peers.delete(id);
      send(r.host, { t: 'peer-leave', id });
    }
  });
});

// Keeps connections alive through tunnels and proxies that drop idle sockets.
setInterval(() => {
  for (const ws of wss.clients) ws.ping();
}, 25000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pact Maker host running. Share one of these:`);
  console.log(`  http://localhost:${PORT}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  http://${a.address}:${PORT}`);
    }
  }
  if (!fs.existsSync(DIST)) console.log('  (no dist/ folder yet: run "npm run build" first)');
});
