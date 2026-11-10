// Pact Maker host: serves the built app (dist/), relays WebSocket messages,
// and saves campaigns to the data/ folder. The host's browser is the authority for game data.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { isHostPcRequest } from './access.mjs';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
// Saved campaigns live here, one JSON file each. Back this folder up to keep your games safe.
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const CAMPAIGNS = path.join(DATA, 'campaigns');
fs.mkdirSync(CAMPAIGNS, { recursive: true });

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

// ---------- saved campaigns (host PC only) ----------
const ID_OK = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BODY = 5 * 1024 * 1024;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (d) => {
      size += d.length;
      if (size > MAX_BODY) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(d);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function campaignApi(req, res, urlPath) {
  // Only the host PC may read or change saves. Players never need this.
  if (!isHostPcRequest(req)) return sendJson(res, 403, { error: 'Host PC only' });

  const m = urlPath.match(/^\/api\/campaigns(?:\/([^/]+))?$/);
  if (!m) return sendJson(res, 404, { error: 'Not found' });
  const id = m[1];

  if (!id) {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
    const list = [];
    for (const f of fs.readdirSync(CAMPAIGNS)) {
      if (!f.endsWith('.json')) continue;
      try {
        const c = JSON.parse(fs.readFileSync(path.join(CAMPAIGNS, f), 'utf8'));
        list.push({ id: c.id, name: c.name, updatedAt: c.updatedAt });
      } catch {
        /* skip unreadable files */
      }
    }
    return sendJson(res, 200, list);
  }

  if (!ID_OK.test(id)) return sendJson(res, 400, { error: 'Bad id' });
  const file = path.join(CAMPAIGNS, `${id}.json`);

  if (req.method === 'GET') {
    if (!fs.existsSync(file)) return sendJson(res, 404, { error: 'No such campaign' });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return fs.createReadStream(file).pipe(res);
  }

  if (req.method === 'PUT') {
    let c;
    try {
      c = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Bad JSON' });
    }
    if (!c || c.id !== id || typeof c.name !== 'string' || !Array.isArray(c.players)) {
      return sendJson(res, 400, { error: 'Not a campaign' });
    }
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(c));
    fs.renameSync(tmp, file); // swap in whole, so a crash never leaves half a file
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'DELETE') {
    fs.rmSync(file, { force: true });
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

// ---------- static files ----------
const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    res.writeHead(400);
    return res.end();
  }

  if (urlPath.startsWith('/api/')) {
    campaignApi(req, res, urlPath).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: 'Server error' });
      else res.end();
    });
    return;
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
