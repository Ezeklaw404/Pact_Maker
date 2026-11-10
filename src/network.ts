import type { HostAddress } from '../server/network.mjs';

/** What the host program knows about how players can reach it. */
export interface NetworkInfo {
  port: number;
  addresses: HostAddress[];
  /** Public https address of a running Cloudflare tunnel, if one was found. */
  tunnel: string | null;
}

export interface JoinLink {
  id: string;
  label: string;
  note: string;
  url: string;
}

export const TUNNEL_COMMAND = 'cloudflared tunnel --url http://localhost:3000';

/** Asks the host program for its addresses. Null when it can't say (dev server, or not on the host PC). */
export async function fetchNetwork(): Promise<NetworkInfo | null> {
  try {
    const res = await fetch('/api/network');
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return null;
    return (await res.json()) as NetworkInfo;
  } catch {
    return null;
  }
}

const joinUrl = (base: string, room: string) => `${base}/join?room=${encodeURIComponent(room)}`;

/** One join link per way players can connect. Falls back to the current address when the host can't say. */
export function joinLinks(info: NetworkInfo | null, room: string, origin: string): JoinLink[] {
  if (!info) {
    return [
      {
        id: 'here',
        label: 'This address',
        note: 'Swap "localhost" for your network, Radmin or tunnel address if players are elsewhere.',
        url: joinUrl(origin, room),
      },
    ];
  }
  const links: JoinLink[] = info.addresses.map((a) => ({
    id: `${a.kind}-${a.address}`,
    label: a.kind === 'radmin' ? 'Radmin' : a.kind === 'vpn' ? `VPN (${a.name})` : 'LAN',
    note: a.kind === 'radmin' ? '' : a.kind === 'vpn' ? 'For friends on the same VPN.' : '',
    url: joinUrl(`http://${a.address}:${info.port}`, room),
  }));
  if (info.tunnel) {
    links.push({
      id: 'tunnel',
      label: 'Internet',
      note: 'The address changes each time the tunnel starts.',
      url: joinUrl(info.tunnel, room),
    });
  }
  return links;
}
