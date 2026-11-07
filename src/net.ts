/**
 * Connection layer. Knows how to talk to server/host.mjs and nothing about the game:
 * payloads are opaque `unknown` here. What they contain is decided later (host logic).
 */

/** Same address the page came from: ws:// for http, wss:// for https (tunnels). */
export function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

/** 6 characters, no look-alikes (no 0/O, 1/I). */
export function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, so no modulo bias
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function parse(data: unknown): { t: string; [key: string]: any } | null {
  try {
    const m = JSON.parse(String(data));
    return m && typeof m.t === 'string' ? m : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- host side

export interface HostHandlers {
  onReady: (room: string) => void;
  onPeerJoin: (id: string, name: string) => void;
  onPeerLeave: (id: string) => void;
  onPeerMessage: (id: string, data: unknown) => void;
  /** Called once when the connection ends, with a reason. */
  onClose: (reason: string) => void;
}

export interface HostConn {
  /** Send to one connected player. */
  send: (id: string, data: unknown) => void;
  kick: (id: string) => void;
  close: () => void;
}

export function startHosting(room: string, h: HostHandlers): HostConn {
  const ws = new WebSocket(wsUrl());
  let reason = 'Connection lost';

  ws.onopen = () => ws.send(JSON.stringify({ t: 'host', room }));
  ws.onmessage = (e) => {
    const m = parse(e.data);
    if (!m) return;
    switch (m.t) {
      case 'hosting':
        h.onReady(m.room);
        break;
      case 'peer-join':
        h.onPeerJoin(m.id, m.name);
        break;
      case 'peer-leave':
        h.onPeerLeave(m.id);
        break;
      case 'peer-msg':
        h.onPeerMessage(m.id, m.data);
        break;
      case 'error':
        reason = m.reason;
        ws.close();
        break;
    }
  };
  ws.onclose = () => h.onClose(reason);

  const raw = (o: object) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(o));
  };
  return {
    send: (id, data) => raw({ t: 'to', id, data }),
    kick: (id) => raw({ t: 'kick', id }),
    close: () => {
      reason = 'Hosting stopped';
      ws.close();
    },
  };
}

// -------------------------------------------------------------- player side

export interface JoinHandlers {
  onJoined: (id: string) => void;
  onMessage: (data: unknown) => void;
  /** Called once when the connection ends: kicked, host left, bad room code, or lost. */
  onClosed: (reason: string) => void;
}

export interface JoinConn {
  /** Send to the host. */
  send: (data: unknown) => void;
  close: () => void;
}

export function joinRoom(room: string, name: string, h: JoinHandlers): JoinConn {
  const ws = new WebSocket(wsUrl());
  let reason = 'Connection lost';

  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', room, name }));
  ws.onmessage = (e) => {
    const m = parse(e.data);
    if (!m) return;
    switch (m.t) {
      case 'joined':
        h.onJoined(m.id);
        break;
      case 'msg':
        h.onMessage(m.data);
        break;
      case 'closed':
        reason = m.reason;
        break;
      case 'error':
        reason = m.reason;
        ws.close();
        break;
    }
  };
  ws.onclose = () => h.onClosed(reason);

  return {
    send: (data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'msg', data }));
    },
    close: () => {
      reason = 'You left';
      ws.close();
    },
  };
}
