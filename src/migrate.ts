import type { Campaign } from './types';

/** Fills in fields that older saved campaigns don't have yet. */
export function migrate(c: Campaign): Campaign {
  for (const p of c.players) {
    p.hp ??= { cur: 10, max: 10 };
    p.mana ??= { cur: 10, max: 10 };
    p.ap ??= { cur: 6, max: 6 };
    if (p.ap.max === 0) p.ap = { cur: 6, max: 6 };
  }
  return c;
}
