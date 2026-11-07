import { describe, expect, it } from 'vitest';
import { newCampaign } from './defaults';
import { reduce } from './reducer';
import { viewFor } from './view';

function make() {
  let c = newCampaign('T', true);
  c = reduce(c, { type: 'addPlayer', name: 'Goblin King' });
  c.players[c.players.length - 1].gmOnly = true;
  return c;
}

describe('viewFor', () => {
  it('never includes GM-only sheets', () => {
    const c = make();
    const json = JSON.stringify(viewFor(c, c.players[0].id));
    expect(json).not.toContain('Goblin King');
  });

  it('gives the player their own sheet and others as name + race only', () => {
    const c = make();
    const v = viewFor(c, c.players[0].id);
    expect(v.me?.id).toBe(c.players[0].id);
    expect(v.others).toHaveLength(2);
    expect(Object.keys(v.others[0]).sort()).toEqual(['id', 'name', 'raceId']);
  });

  it('gives an unknown player no sheet', () => {
    const c = make();
    const v = viewFor(c, 'nope');
    expect(v.me).toBeNull();
    expect(v.others).toHaveLength(3);
  });

  it('hides DM-granted abilities the player does not own', () => {
    const c = make();
    const v = viewFor(c, c.players[0].id);
    expect(v.abilities.some((a) => a.id === 'swordsmanship')).toBe(false);
    expect(v.abilities.some((a) => a.id === 'fireball')).toBe(true);
  });
});
