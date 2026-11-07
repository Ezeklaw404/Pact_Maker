import type { Permission, PlayerRequest, ToPlayer } from './protocol';
import type { Action } from './reducer';
import type { Campaign, Target } from './types';
import { viewFor } from './view';

/** One connected player, as the host sees them. */
export interface Session {
  peerId: string;
  name: string;
  /** Which character they control (null = spectator). */
  playerId: string | null;
  permission: Permission;
}

/** Auto-assigns a character when the joining name matches one (any case). GM-only sheets never match. */
export function newSession(c: Campaign, peerId: string, name: string): Session {
  const wanted = name.trim().toLowerCase();
  const match = c.players.find((p) => !p.gmOnly && p.name.trim().toLowerCase() === wanted);
  return { peerId, name, playerId: match?.id ?? null, permission: 'view' };
}

/** Checks the shape of anything a player sends. Returns a clean request or null. */
export function parseRequest(data: unknown): PlayerRequest | null {
  const m = data as { k?: unknown; req?: any } | null;
  if (!m || m.k !== 'req' || !m.req || typeof m.req !== 'object') return null;
  const r = m.req;

  if (r.type === 'award' && Array.isArray(r.targets) && r.targets.length > 0 && r.targets.length <= 20) {
    const targets: Target[] = [];
    for (const t of r.targets) {
      if (!t || (t.type !== 'stat' && t.type !== 'ability')) return null;
      if (typeof t.id !== 'string' || t.id.length > 64) return null;
      targets.push({ type: t.type, id: t.id }); // rebuilt, so extra fields are dropped
    }
    return { type: 'award', targets };
  }
  return null;
}

export type Decision = { ok: true; action: Action } | { ok: false; reason: string };

/** Decides whether this player may do this, and builds the real Action if so. */
export function authorize(c: Campaign, s: Session, req: PlayerRequest): Decision {
  const mine = c.players.find((p) => p.id === s.playerId && !p.gmOnly);
  if (!mine) return { ok: false, reason: 'You are not assigned to a character yet.' };

  switch (req.type) {
    case 'award': {
      if (s.permission !== 'xp') return { ok: false, reason: 'The host has not given you permission to add XP.' };
      const valid = req.targets.filter((t) =>
        t.type === 'stat' ? c.stats.some((x) => x.id === t.id) : c.abilities.some((a) => a.id === t.id),
      );
      if (!valid.length) return { ok: false, reason: 'Nothing valid to add XP to.' };
      // Only their own character, and the base is fixed at 1: players cannot choose either.
      return { ok: true, action: { type: 'award', playerIds: [mine.id], targets: valid, base: 1 } };
    }
  }
}

/** The one message a player gets about the campaign: their filtered view plus their permission. */
export function messageFor(c: Campaign, s: Session): ToPlayer {
  return { k: 'view', view: viewFor(c, s.playerId), permission: s.permission };
}
