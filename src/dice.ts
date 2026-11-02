export interface DiceSpec {
  count: number;
  sides: number;
  mod: number;
}

/** Parses "3d6", "2d10+3", "1d20-1". Returns null if invalid. */
export function parseDice(expr: string): DiceSpec | null {
  const m = /^\s*(\d{1,3})\s*d\s*(\d{1,4})\s*(?:([+-])\s*(\d{1,4}))?\s*$/i.exec(expr);
  if (!m) return null;
  const count = Number(m[1]);
  const sides = Number(m[2]);
  if (count < 1 || sides < 2) return null;
  const mod = m[3] ? Number(m[4]) * (m[3] === '-' ? -1 : 1) : 0;
  return { count, sides, mod };
}

export interface RollResult {
  rolls: number[];
  mod: number;
  total: number;
}

export function rollDice(expr: string, bonus = 0, rng: () => number = Math.random): RollResult | null {
  const spec = parseDice(expr);
  if (!spec) return null;
  const rolls = Array.from({ length: spec.count }, () => 1 + Math.floor(rng() * spec.sides));
  const mod = spec.mod + bonus;
  return { rolls, mod, total: rolls.reduce((a, b) => a + b, 0) + mod };
}
