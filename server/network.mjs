import http from 'node:http';
import os from 'node:os';

// Adapters that only exist inside this PC (WSL, Docker, VMs): players can never reach them.
const VIRTUAL = /vethernet|wsl|docker|virtualbox|vmware|hyper-v|loopback|bluetooth/i;
const OTHER_VPN = /tailscale|zerotier|hamachi|wireguard|vpn/i;
const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
const CGNAT = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./; // Tailscale style addresses

/** This PC's IPv4 addresses, labelled: 'lan', 'radmin' or 'vpn'. Unreachable ones are left out. */
export function listAddresses(ifaces = os.networkInterfaces()) {
  const out = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (VIRTUAL.test(name)) continue;
    for (const a of addrs ?? []) {
      const v4 = a.family === 'IPv4' || a.family === 4;
      if (!v4 || a.internal || a.address.startsWith('169.254.')) continue;
      let kind = null;
      if (/radmin/i.test(name) || a.address.startsWith('26.')) kind = 'radmin';
      else if (OTHER_VPN.test(name) || CGNAT.test(a.address)) kind = 'vpn';
      else if (PRIVATE.test(a.address)) kind = 'lan';
      if (kind) out.push({ name, address: a.address, kind });
    }
  }
  return out;
}

/** Turns cloudflared's {"hostname": "..."} answer into an https address, or null if it isn't one. */
export function parseTunnelHostname(body) {
  try {
    const h = JSON.parse(body).hostname;
    if (typeof h !== 'string' || !h.trim()) return null;
    return /^https?:\/\//.test(h) ? h.trim() : `https://${h.trim()}`;
  } catch {
    return null;
  }
}

function probe(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/quicktunnel', timeout: 500 }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve(parseTunnelHostname(body)));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

/**
 * The public https address of a running Cloudflare quick tunnel, or null.
 * cloudflared answers on one of ports 20241-20245 of this PC.
 */
export async function findTunnel(ports = [20241, 20242, 20243, 20244, 20245]) {
  return (await Promise.all(ports.map(probe))).find(Boolean) ?? null;
}
