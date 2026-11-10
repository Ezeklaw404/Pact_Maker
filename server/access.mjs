import os from 'node:os';

/**
 * True when a connection comes from the host PC itself: loopback, or one of this
 * machine's own addresses (so http://192.168.x.x:3000 opened on the host PC counts too).
 */
export function isLocalAddress(addr, ifaces = os.networkInterfaces()) {
  if (!addr) return false;
  const a = String(addr)
    .replace(/^::ffff:/i, '')
    .toLowerCase();
  if (a === '::1' || a.startsWith('127.')) return true;
  for (const list of Object.values(ifaces)) {
    for (const i of list ?? []) if (String(i.address).toLowerCase() === a) return true;
  }
  return false;
}

// Headers that tunnels and proxies (Cloudflare, ngrok, nginx...) add when they forward someone else's traffic.
const PROXY_HEADERS = [
  'x-forwarded-for',
  'x-forwarded-host',
  'x-real-ip',
  'forwarded',
  'cf-connecting-ip',
  'cf-ray',
  'via',
];

/**
 * True only for someone using the host PC directly. A tunnel runs on the host PC, so its visitors
 * look local; the headers it adds give it away, and those requests are refused.
 */
export function isHostPcRequest(req) {
  if (PROXY_HEADERS.some((h) => req.headers[h] !== undefined)) return false;
  return isLocalAddress(req.socket.remoteAddress);
}
