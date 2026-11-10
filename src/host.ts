import type { Permission, PlayerRequest, ToPlayer } from './protocol';
import type { Action } from './reducer';
import type { Campaign, Target } from './types';
import { viewFor } from './view';
import { isUnlocked, levelToXp } from './xp';

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
  return { peerId, name, playerId: match?.id ?? null, permission: 'edit' };
}

function parseTarget(t: any): Target | null {
  if (!t || (t.type !== 'stat' && t.type !== 'ability')) return null;
  if (typeof t.id !== 'string' || t.id.length > 64) return null;
  return { type: t.type, id: t.id }; // rebuilt, so extra fields are dropped
}

const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null;

/** Checks the shape of anything a player sends. Returns a clean request or null. */
export function parseRequest(data: unknown): PlayerRequest | null {
  const m = data as { k?: unknown; req?: any } | null;
  if (!m || m.k !== 'req' || !m.req || typeof m.req !== 'object') return null;
  const r = m.req;

  if (r.type === 'award' && Array.isArray(r.targets) && r.targets.length > 0 && r.targets.length <= 20) {
    const targets: Target[] = [];
    for (const t of r.targets) {
      const clean = parseTarget(t);
      if (!clean) return null;
      targets.push(clean);
    }
    return { type: 'award', targets };
  }

  if (r.type === 'pool' && (r.pool === 'hp' || r.pool === 'ap' || r.pool === 'mana')) {
    const out: PlayerRequest = { type: 'pool', pool: r.pool };
    if (r.cur !== undefined) {
      const cur = num(r.cur, -1e6, 1e6);
      if (cur === null) return null;
      out.cur = cur;
    }
    if (r.max !== undefined) {
      const max = num(r.max, 0, 1e6);
      if (max === null) return null;
      out.max = max;
    }
    return out.cur === undefined && out.max === undefined ? null : out;
  }

  if (r.type === 'setLevel') {
    const target = parseTarget(r.target);
    const level = num(r.level, 0, 200);
    return target && level !== null ? { type: 'setLevel', target, level } : null;
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
      if (s.permission !== 'admin')
        return { ok: false, reason: 'The host has not made you an admin, so you cannot add XP.' };
      const valid = req.targets.filter((t) =>
        t.type === 'stat' ? c.stats.some((x) => x.id === t.id) : c.abilities.some((a) => a.id === t.id),
      );
      if (!valid.length) return { ok: false, reason: 'Nothing valid to add XP to.' };
      return { ok: true, action: { type: 'award', playerIds: [mine.id], targets: valid, base: 1 } };
    }

    case 'pool': {
      if (s.permission === 'view') return { ok: false, reason: 'You have view-only access.' };
      if (req.max !== undefined && s.permission !== 'admin')
        return { ok: false, reason: 'Only admins can change maximums.' };
      return { ok: true, action: { type: 'setPool', playerId: mine.id, pool: req.pool, cur: req.cur, max: req.max } };
    }

    case 'setLevel': {
      if (s.permission !== 'admin') return { ok: false, reason: 'Only admins can edit XP.' };
      const t = req.target;
      if (t.type === 'stat') {
        if (!c.stats.some((x) => x.id === t.id)) return { ok: false, reason: 'Unknown stat.' };
      } else {
        const def = c.abilities.find((a) => a.id === t.id);
        if (!def || !isUnlocked(c, mine, def)) return { ok: false, reason: 'You do not have that ability.' };
      }
      return { ok: true, action: { type: 'setXp', playerId: mine.id, target: t, xp: levelToXp(req.level, c.rules) } };
    }
  }
}

/** The one message a player gets about the campaign: their filtered view plus their permission. */
export function messageFor(c: Campaign, s: Session): ToPlayer {
  return { k: 'view', view: viewFor(c, s.playerId), permission: s.permission };
}
