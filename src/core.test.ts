import { describe, expect, it } from 'vitest';
import { newCampaign } from './defaults';
import { parseDice, rollDice } from './dice';
import { commit, createHistory, redo, undo } from './history';
import { exportCampaign, importCampaign } from './portable';
import { reduce } from './reducer';
import {
  cumXp,
  formatLevel,
  isMastered,
  isUnlocked,
  levelInfo,
  levelToXp,
  multiplier,
} from './xp';

const sample = (name = 'Test') => newCampaign(name, true);
const rules = { baseXp: 10, growth: 2, techniqueCap: 5, dice: '3d6' };

describe('level curve', () => {
  it('doubles the cost each level (10, 20, 40...)', () => {
    expect(cumXp(0, rules)).toBe(0);
    expect(cumXp(1, rules)).toBe(10);
    expect(cumXp(2, rules)).toBe(30);
    expect(cumXp(3, rules)).toBe(70);
  });

  it('computes level and progress', () => {
    expect(levelInfo(0, rules).level).toBe(0);
    expect(levelInfo(9, rules).level).toBe(0);
    expect(levelInfo(10, rules).level).toBe(1);
    expect(levelInfo(20, rules)).toMatchObject({ level: 1, into: 10, needed: 20 });
    expect(levelInfo(70, rules).level).toBe(3);
  });

  it('formats with 2 decimals and never rounds up a level', () => {
    expect(formatLevel(0, rules)).toBe('0.00');
    expect(formatLevel(1, rules)).toBe('0.10');
    expect(formatLevel(9.99, rules)).toBe('0.99');
    expect(formatLevel(10, rules)).toBe('1.00');
    expect(formatLevel(11, rules)).toBe('1.05');
  });

  it('converts a typed level back to xp', () => {
    expect(levelToXp(1.05, rules)).toBeCloseTo(11, 3);
    expect(levelToXp(0, rules)).toBe(0);
    expect(levelToXp(3, rules)).toBe(70);
  });
});

describe('modifiers', () => {
  it('stack multiplicatively: combat 3x and favorite 2x = 6x', () => {
    let c = sample();
    const pid = c.players[0].id;
    c = reduce(c, { type: 'setFavorite', playerId: pid, statId: 'force' });
    c = reduce(c, { type: 'toggleCombat' });
    expect(multiplier(c, c.players[0], { type: 'stat', id: 'force' })).toBe(6);
    expect(multiplier(c, c.players[0], { type: 'stat', id: 'grit' })).toBe(3);
  });

  // it('favorite primary also boosts its secondary stats', () => {
  //   let c = sample();
  //   c = reduce(c, { type: 'setFavorite', playerId: c.players[0].id, statId: 'force' });
  //   expect(multiplier(c, c.players[0], { type: 'stat', id: 'area' })).toBe(2);      TODO area is not a secondary anymore so this needs a fix
  //   expect(multiplier(c, c.players[0], { type: 'stat', id: 'fire' })).toBe(1);
  // });

  it('misc boost multiplies too', () => {
    let c = sample();
    const pid = c.players[0].id;
    c = reduce(c, { type: 'setMisc', playerId: pid, on: true, mult: 1.5 });
    c = reduce(c, { type: 'toggleCombat' });
    expect(multiplier(c, c.players[0], { type: 'stat', id: 'grit' })).toBe(4.5);
  });
});

describe('award', () => {
  it('gives 1 xp per action and logs it', () => {
    let c = sample();
    const pid = c.players[0].id;
    c = reduce(c, { type: 'award', playerIds: [pid], targets: [{ type: 'stat', id: 'force' }], base: 1 });
    expect(c.players[0].stats.force).toBe(1);
    expect(c.log.at(-1)?.text).toContain('Force +1');
  });

  it('applies combat to the whole party', () => {
    let c = sample();
    c = reduce(c, { type: 'toggleCombat' });
    c = reduce(c, {
      type: 'award',
      playerIds: c.players.map((p) => p.id),
      targets: [{ type: 'stat', id: 'force' }],
      base: 1,
    });
    expect(c.players.every((p) => p.stats.force === 3)).toBe(true);
  });

  it('can award several stats at once', () => {
    let c = sample();
    c = reduce(c, {
      type: 'award',
      playerIds: [c.players[0].id],
      targets: [
        { type: 'stat', id: 'force' },
        { type: 'stat', id: 'fire' },
      ],
      base: 1,
    });
    expect(c.players[0].stats).toMatchObject({ force: 1, fire: 1 });
  });

  it('skips locked abilities', () => {
    let c = sample();
    const before = c;
    c = reduce(c, {
      type: 'award',
      playerIds: [c.players[0].id],
      targets: [{ type: 'ability', id: 'fireball' }],
      base: 1,
    });
    expect(c).toBe(before);
  });

  it('does not mutate the previous state', () => {
    const c = sample();
    reduce(c, { type: 'award', playerIds: [c.players[0].id], targets: [{ type: 'stat', id: 'force' }], base: 5 });
    expect(c.players[0].stats.force).toBeUndefined();
  });
});

describe('techniques and skills', () => {
  it('auto-unlocks a technique when stat thresholds are met', () => {
    let c = sample();
    const pid = c.players[0].id;
    const fireball = c.abilities.find((a) => a.id === 'fireball')!;
    expect(isUnlocked(c, c.players[0], fireball)).toBe(false);
    c = reduce(c, { type: 'setXp', playerId: pid, target: { type: 'stat', id: 'force' }, xp: levelToXp(4, c.rules) });
    c = reduce(c, { type: 'setXp', playerId: pid, target: { type: 'stat', id: 'area' }, xp: levelToXp(2, c.rules) });
    c = reduce(c, { type: 'setXp', playerId: pid, target: { type: 'stat', id: 'fire' }, xp: levelToXp(1, c.rules) });
    expect(isUnlocked(c, c.players[0], fireball)).toBe(true);
  });

  it('caps techniques at level 5 (mastered) but not skills', () => {
    let c = sample();
    const pid = c.players[0].id;
    c = reduce(c, { type: 'learn', playerId: pid, abilityId: 'swordsmanship' });
    c = reduce(c, { type: 'setXp', playerId: pid, target: { type: 'ability', id: 'swordsmanship' }, xp: 100000 });
    expect(c.players[0].abilities.swordsmanship).toBe(100000);

    c = reduce(c, {
      type: 'addAbility',
      def: { name: 'Spark', kind: 'technique', statId: 'force', requires: {}, unlock: 'auto', apCost: 1, manaCost: 1, notes: '' },
    });
    c = reduce(c, { type: 'setXp', playerId: pid, target: { type: 'ability', id: 'spark' }, xp: 100000 });
    const def = c.abilities.find((a) => a.id === 'spark')!;
    expect(c.players[0].abilities.spark).toBe(cumXp(5, c.rules));
    expect(isMastered(def, c.players[0].abilities.spark, c.rules)).toBe(true);
  });
});

describe('spendable xp', () => {
  it('can be granted and spent on secondary stats, not primary', () => {
    let c = sample();
    const pid = c.players[0].id;
    c = reduce(c, { type: 'grantSpendable', playerIds: c.players.map((p) => p.id), amount: 10 });
    expect(c.players.every((p) => p.spendableXp === 10)).toBe(true);

    const blocked = reduce(c, { type: 'spend', playerId: pid, target: { type: 'stat', id: 'force' }, amount: 5 });
    expect(blocked).toBe(c);

    c = reduce(c, { type: 'spend', playerId: pid, target: { type: 'stat', id: 'fire' }, amount: 4 });
    expect(c.players[0].stats.fire).toBe(4);
    expect(c.players[0].spendableXp).toBe(6);
  });

  it('cannot overspend', () => {
    const c = sample();
    const next = reduce(c, { type: 'spend', playerId: c.players[0].id, target: { type: 'stat', id: 'fire' }, amount: 1 });
    expect(next).toBe(c);
  });
});

describe('pools and library', () => {
  it('keeps current within 0..max', () => {
    let c = sample();
    const pid = c.players[0].id;
    c = reduce(c, { type: 'setPool', playerId: pid, pool: 'mana', max: 10, cur: 15 });
    expect(c.players[0].mana).toEqual({ cur: 10, max: 10 });
    c = reduce(c, { type: 'setPool', playerId: pid, pool: 'mana', cur: -3 });
    expect(c.players[0].mana.cur).toBe(0);
  });

  it('adds stats, races, and gives unique ids', () => {
    let c = sample();
    c = reduce(c, { type: 'addStat', name: 'Fire', kind: 'secondary' });
    expect(c.stats.filter((s) => s.name === 'Fire').map((s) => s.id)).toEqual(['fire', 'fire-2']);
    c = reduce(c, { type: 'addRace', name: 'Orc' });
    expect(c.races.at(-1)?.id).toBe('orc');
  });
});

describe('undo / redo', () => {
  it('walks back and forward', () => {
    const c0 = sample();
    const c1 = reduce(c0, { type: 'toggleCombat' });
    let h = createHistory(c0);
    h = commit(h, c1);
    expect(h.present.combat).toBe(true);
    h = undo(h);
    expect(h.present.combat).toBe(false);
    h = redo(h);
    expect(h.present.combat).toBe(true);
  });

  it('a new change clears the redo stack', () => {
    const c0 = sample();
    let h = createHistory(c0);
    h = commit(h, reduce(c0, { type: 'toggleCombat' }));
    h = undo(h);
    h = commit(h, reduce(h.present, { type: 'addPlayer', name: 'Zed' }));
    expect(h.future).toHaveLength(0);
  });
});

describe('dice', () => {
  it('parses expressions', () => {
    expect(parseDice('3d6')).toEqual({ count: 3, sides: 6, mod: 0 });
    expect(parseDice('2d10+3')).toEqual({ count: 2, sides: 10, mod: 3 });
    expect(parseDice('nope')).toBeNull();
  });

  it('rolls with a stat bonus', () => {
    const r = rollDice('3d6', 4, () => 0.5)!;
    expect(r.rolls).toEqual([4, 4, 4]);
    expect(r.total).toBe(16);
  });
});

describe('export / import', () => {
  it('round-trips a whole campaign with a new id', () => {
    const c = sample('Test');
    const back = importCampaign(exportCampaign(c));
    expect(back.id).not.toBe(c.id);
    expect(back.players).toEqual(c.players);
  });

  it('rejects junk', () => {
    expect(() => importCampaign('{"hello":1}')).toThrow();
  });
});
