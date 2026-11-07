import { useCallback, useEffect, useRef, useState } from 'react';
import { authorize, messageFor, newSession, parseRequest, type Session } from './host';
import { makeRoomCode, startHosting, type HostConn } from './net';
import type { Permission } from './protocol';
import type { Action } from './reducer';
import type { Campaign } from './types';

export type HostStatus = 'off' | 'starting' | 'on';
export type HostApi = ReturnType<typeof useHost>;

/** Keeps the host connection, the connected players, and sends each player their own view. */
export function useHost(campaign: Campaign | undefined, dispatch: (a: Action) => void) {
  const [status, setStatus] = useState<HostStatus>('off');
  const [room, setRoom] = useState('');
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);

  // Refs so the connection handlers always see the latest values.
  const connRef = useRef<HostConn | null>(null);
  const map = useRef(new Map<string, Session>());
  const campaignRef = useRef(campaign);
  campaignRef.current = campaign;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const publish = useCallback(() => setSessions([...map.current.values()]), []);

  const start = useCallback(() => {
    if (connRef.current) return;
    setError('');
    setStatus('starting');

    const conn: HostConn = startHosting(makeRoomCode(), {
      onReady: (r) => {
        setRoom(r);
        setStatus('on');
      },
      onPeerJoin: (id, name) => {
        const c = campaignRef.current;
        if (!c) return;
        map.current.set(id, newSession(c, id, name));
        publish();
      },
      onPeerLeave: (id) => {
        map.current.delete(id);
        publish();
      },
      onPeerMessage: (id, data) => {
        const s = map.current.get(id);
        const c = campaignRef.current;
        const req = parseRequest(data);
        if (!s || !c || !req) return;
        const d = authorize(c, s, req);
        if (d.ok) dispatchRef.current(d.action);
        else conn.send(id, { k: 'notice', text: d.reason });
      },
      onClose: (reason) => {
        if (connRef.current !== conn) return; // an older connection ending
        connRef.current = null;
        map.current.clear();
        publish();
        setStatus('off');
        setRoom('');
        setError(reason === 'Hosting stopped' ? '' : reason);
      },
    });
    connRef.current = conn;
  }, [publish]);

  const stop = useCallback(() => connRef.current?.close(), []);
  const kick = useCallback((peerId: string) => connRef.current?.kick(peerId), []);

  const setPermission = useCallback(
    (peerId: string, permission: Permission) => {
      const s = map.current.get(peerId);
      if (!s) return;
      map.current.set(peerId, { ...s, permission });
      publish();
    },
    [publish],
  );

  const assign = useCallback(
    (peerId: string, playerId: string | null) => {
      const s = map.current.get(peerId);
      if (!s) return;
      map.current.set(peerId, { ...s, playerId });
      publish();
    },
    [publish],
  );

  // Switching campaigns while hosting: match everyone to the new campaign by name again.
  const lastCampaignId = useRef(campaign?.id);
  useEffect(() => {
    if (!campaign || campaign.id === lastCampaignId.current) return;
    lastCampaignId.current = campaign.id;
    for (const [id, s] of map.current) map.current.set(id, newSession(campaign, id, s.name));
    publish();
  }, [campaign, publish]);

  // Whenever the campaign or anyone's assignment/permission changes, send each player their view.
  useEffect(() => {
    const conn = connRef.current;
    if (!conn || !campaign) return;
    for (const s of sessions) conn.send(s.peerId, messageFor(campaign, s));
  }, [campaign, sessions]);

  // Closing the page or unmounting stops hosting.
  useEffect(() => () => connRef.current?.close(), []);

  return { status, room, error, sessions, start, stop, kick, setPermission, assign };
}
