export interface HostAddress {
  name: string;
  address: string;
  kind: 'lan' | 'radmin' | 'vpn';
}
export function listAddresses(ifaces?: Record<string, unknown[] | undefined>): HostAddress[];
export function parseTunnelHostname(body: string): string | null;
export function findTunnel(ports?: number[]): Promise<string | null>;
