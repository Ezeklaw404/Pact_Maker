import { describe, expect, it } from 'vitest';
import { newCampaign } from './defaults';
import { authorize, messageFor, newSession, parseRequest } from './host';
import { reduce } from './reducer';

function make() {
  let c = newCampaign('T', true);
  c = reduce(c, { type: 'addPlayer', name: 'Goblin King' });
  c.players[c.players.length - 1].gmOnly = true;
  return c;
}

const award = (...ids: string[]) => ({
  type: 'award' as const,
  targets: ids.map((id) => ({ type: 'stat' as const, id })),
});

describe('sessions', () => {
  it('matches a joiner to the character with their name, any case', () => {
    const c = make();
    expect(newSession(c, '1', ' player 2 ').playerId).toBe(c.players[1].id);
    expect(newSession(c, '2', 'Nobody').playerId).toBeNull();
  });

  it('never matches a GM-only sheet', () => {
    const c = make();
    expect(newSession(c, '1', 'Goblin King').playerId).toBeNull();
  });

  it('starts view-only', () => {
    const c = make();
    expect(newSession(c, '1', 'Player 1').permission).toBe('view');
  });
});

describe('authorize', () => {
  it('denies view-only players', () => {
    const c = make();
    const s = newSession(c, '1', 'Player 1');
    expect(authorize(c, s, award('force')).ok).toBe(false);
  });

  it('denies players with no character', () => {
    const c = make();
    const s = { ...newSession(c, '1', 'Nobody'), permission: 'xp' as const };
    expect(authorize(c, s, award('force')).ok).toBe(false);
  });

  it('turns an allowed request into +1 XP for their own character only', () => {
    const c = make();
    const s = { ...newSession(c, '1', 'Player 1'), permission: 'xp' as const };
    const d = authorize(c, s, award('force'));
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    const next = reduce(c, d.action);
    expect(next.players[0].stats.force).toBe(1);
    expect(next.players[1].stats.force).toBeUndefined();
  });

  it('drops unknown ids and denies when nothing valid is left', () => {
    const c = make();
    const s = { ...newSession(c, '1', 'Player 1'), permission: 'xp' as const };
    expect(authorize(c, s, award('nonsense')).ok).toBe(false);
    const d = authorize(c, s, award('nonsense', 'grit'));
    expect(d.ok && d.action.type === 'award' && d.action.targets.length).toBe(1);
  });
});

describe('parseRequest', () => {
  it('accepts a good award request and strips extra fields', () => {
    const r = parseRequest({ k: 'req', req: { type: 'award', targets: [{ type: 'stat', id: 'force', evil: 1 }] } });
    expect(r).toEqual({ type: 'award', targets: [{ type: 'stat', id: 'force' }] });
  });

  it('rejects junk, including raw reducer actions', () => {
    const bad = [
      null,
      'x',
      {},
      { k: 'req' },
      { k: 'req', req: { type: 'award', targets: [] } },
      { k: 'req', req: { type: 'award', targets: [{ type: 'stat', id: 5 }] } },
      { k: 'req', req: { type: 'setXp', playerId: 'x', xp: 9999 } },
      { k: 'req', req: { type: 'award', targets: Array(21).fill({ type: 'stat', id: 'force' }) } },
    ];
    for (const b of bad) expect(parseRequest(b)).toBeNull();
  });
});

describe('messageFor', () => {
  it('sends a filtered view and the permission', () => {
    const c = make();
    const m = messageFor(c, newSession(c, '1', 'Player 1'));
    expect(m.k).toBe('view');
    expect(JSON.stringify(m)).not.toContain('Goblin King');
  });
});
