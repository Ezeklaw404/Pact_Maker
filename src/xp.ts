import type { AbilityDef, Campaign, Player, Rules, Target } from './types';

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Total xp needed to reach a whole level. Level 0 = 0, level 1 = baseXp, level 2 = baseXp * (1 + growth)... */
export function cumXp(level: number, rules: Rules): number {
  if (level <= 0) return 0;
  const { baseXp, growth } = rules;
  if (growth === 1) return baseXp * level;
  return baseXp * ((Math.pow(growth, level) - 1) / (growth - 1));
}

export interface LevelInfo {
  level: number;
  /** xp earned inside the current level */
  into: number;
  /** xp needed to finish the current level */
  needed: number;
  /** 0..1 progress through the current level */
  progress: number;
}

export function levelInfo(xp: number, rules: Rules): LevelInfo {
  const safe = Math.max(0, xp);
  let level = 0;
  while (level < 200 && safe >= cumXp(level + 1, rules) - 1e-9) level++;
  const start = cumXp(level, rules);
  const needed = cumXp(level + 1, rules) - start;
  const into = Math.max(0, safe - start);
  return { level, into, needed, progress: Math.min(1, into / needed) };
}

/** "4.05" style label. Decimals never round up into the next whole level. */
export function formatLevel(xp: number, rules: Rules, decimals = 2): string {
  const { level, progress } = levelInfo(xp, rules);
  const scale = Math.pow(10, decimals);
  const frac = Math.min(scale - 1, Math.floor(progress * scale + 1e-9));
  return `${level}.${String(frac).padStart(decimals, '0')}`;
}

/** Convert a "4.05" style level back to total xp (for manual DM edits). */
export function levelToXp(levelValue: number, rules: Rules): number {
  const whole = Math.max(0, Math.floor(levelValue + 1e-9));
  const frac = Math.max(0, Math.min(0.9999, levelValue - whole));
  const needed = cumXp(whole + 1, rules) - cumXp(whole, rules);
  return round4(cumXp(whole, rules) + frac * needed);
}

export function abilityCap(def: AbilityDef, rules: Rules): number | undefined {
  if (def.cap !== undefined) return def.cap;
  return def.kind === 'technique' ? rules.techniqueCap : undefined;
}

export function clampAbilityXp(def: AbilityDef, xp: number, rules: Rules): number {
  const cap = abilityCap(def, rules);
  if (cap === undefined) return xp;
  return Math.min(xp, cumXp(cap, rules));
}

export function isMastered(def: AbilityDef, xp: number, rules: Rules): boolean {
  const cap = abilityCap(def, rules);
  return cap !== undefined && levelInfo(xp, rules).level >= cap;
}

export function statXp(p: Player, statId: string): number {
  return p.stats[statId] ?? 0;
}

export function statLevel(p: Player, statId: string, rules: Rules): number {
  return levelInfo(statXp(p, statId), rules).level;
}
export function meetsRequirements(c: Pick<Campaign, 'rules'>, p: Player, def: AbilityDef): boolean {
  return Object.entries(def.requires).every(([statId, min]) => statLevel(p, statId, c.rules) >= min);
}

export function isUnlocked(c: Pick<Campaign, 'rules'>, p: Player, def: AbilityDef): boolean {
  if (def.unlock === 'auto') return meetsRequirements(c, p, def);
  return def.id in p.abilities;
}

/** Combined xp multiplier for one player and one target. */
export function multiplier(c: Pick<Campaign, 'combat' | 'stats' | 'abilities'>, p: Player, target: Target): number {
  let m = 1;
  if (c.combat) m *= 3;
  if (p.misc.on) m *= p.misc.mult;
  let statId: string | undefined;
  if (target.type === 'stat') statId = target.id;
  else statId = c.abilities.find((a) => a.id === target.id)?.statId;
  const fav = c.stats.find((s) => s.id === p.favoriteStatId && s.kind === 'primary')?.id;
  if (fav && statId) {
    const parent = c.stats.find((s) => s.id === statId)?.parentId;
    if (statId === fav || parent === fav) m *= 2;
  }
  return round4(m);
}

export function targetName(c: Pick<Campaign, 'stats' | 'abilities'>, t: Target): string {
  if (t.type === 'stat') return c.stats.find((s) => s.id === t.id)?.name ?? t.id;
  return c.abilities.find((a) => a.id === t.id)?.name ?? t.id;
}

export const SPEND_AMOUNT = 1;

export function spendRoom(c: Pick<Campaign, 'abilities' | 'rules'>, t: Target, xp: number): number {
  if (t.type === 'stat') return Infinity;
  const def = c.abilities.find((a) => a.id === t.id);
  const cap = def ? abilityCap(def, c.rules) : undefined;
  return cap === undefined ? Infinity : Math.max(0, cumXp(cap, c.rules) - xp);
}

export function canSpendOn(c: Pick<Campaign, 'stats' | 'abilities' | 'rules'>, p: Player, t: Target): boolean {
  if (t.type === 'stat') return c.stats.find((s) => s.id === t.id)?.kind === 'secondary';
  const def = c.abilities.find((a) => a.id === t.id);
  return !!def && isUnlocked(c, p, def) && spendRoom(c, t, p.abilities[t.id] ?? 0) > 0;
}

export function spendPreview(xp: number, room: number, rules: Rules, mult = 1) {
  const gain = Math.min(round4(SPEND_AMOUNT * mult), room);
  const now = levelInfo(xp, rules);
  const next = levelInfo(xp + gain, rules);
  return {
    label: formatLevel(xp + gain, rules),
    from: now.progress * 100,
    to: next.level > now.level ? 100 : next.progress * 100,
  };
}
