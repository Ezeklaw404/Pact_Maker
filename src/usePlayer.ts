import { useCallback, useEffect, useRef, useState } from 'react';
import { joinRoom, type JoinConn } from './net';
import type { Permission, PlayerRequest, ToHost, ToPlayer } from './protocol';
import type { PlayerView } from './view';

export type PlayerStatus = 'idle' | 'connecting' | 'in';

/** The player's side of a session: joins a room, keeps the latest view the host sent. */
export function usePlayer() {
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [view, setView] = useState<PlayerView | null>(null);
  const [permission, setPermission] = useState<Permission>('view');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const connRef = useRef<JoinConn | null>(null);

  const join = useCallback((room: string, name: string) => {
    if (connRef.current) return;
    setError('');
    setStatus('connecting');

    const conn: JoinConn = joinRoom(room.trim().toUpperCase(), name.trim(), {
      onJoined: () => setStatus('in'),
      onMessage: (data) => {
        const m = data as ToPlayer | null;
        if (!m || typeof m !== 'object') return;
        if (m.k === 'view') {
          setView(m.view);
          setPermission(m.permission);
        } else if (m.k === 'notice') {
          setNotice(m.text);
        }
      },
      onClosed: (reason) => {
        if (connRef.current !== conn) return;
        connRef.current = null;
        setStatus('idle');
        setView(null);
        setNotice('');
        setError(reason === 'You left' ? '' : reason);
      },
    });
    connRef.current = conn;
  }, []);

  const leave = useCallback(() => connRef.current?.close(), []);

  /** Asks the host to add XP to these targets on my own character. The host decides. */
  const request = useCallback((req: PlayerRequest) => {
    const msg: ToHost = { k: 'req', req };
    connRef.current?.send(msg);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => () => connRef.current?.close(), []);

  return { status, view, permission, notice, error, join, leave, request };
}
