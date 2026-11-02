import type { AbilityDef, Campaign, Player, StatKind, Target } from './types';
import { newPlayer } from './defaults';
import {
  clampAbilityXp,
  formatLevel,
  isUnlocked,
  multiplier,
  round4,
  targetName,
  uid,
} from './xp';

export type Action =
  | { type: 'award'; playerIds: string[]; targets: Target[]; base: number }
  | { type: 'setXp'; playerId: string; target: Target; xp: number }
  | { type: 'grantSpendable'; playerIds: string[]; amount: number }
  | { type: 'spend'; playerId: string; target: Target; amount: number }
  | { type: 'toggleCombat' }
  | { type: 'setFavorite'; playerId: string; statId: string | null }
  | { type: 'setMisc'; playerId: string; on?: boolean; mult?: number }
  | { type: 'setPool'; playerId: string; pool: 'ap' | 'mana'; cur?: number; max?: number }
  | { type: 'addPlayer'; name: string }
  | { type: 'removePlayer'; playerId: string }
  | { type: 'renamePlayer'; playerId: string; name: string }
  | { type: 'setRace'; playerId: string; raceId: string | null }
  | { type: 'learn'; playerId: string; abilityId: string }
  | { type: 'forget'; playerId: string; abilityId: string }
  | { type: 'addStat'; name: string; kind: StatKind; parentId?: string }
  | { type: 'addRace'; name: string }
  | { type: 'addAbility'; def: Omit<AbilityDef, 'id'> }
  | { type: 'setRulesText'; text: string }
  | { type: 'setDice'; dice: string }
  | { type: 'renameCampaign'; name: string };

const MAX_LOG = 500;

function slug(name: string, taken: string[]): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
  let id = base;
  let n = 2;
  while (taken.includes(id)) id = `${base}-${n++}`;
  return id;
}

function log(c: Campaign, text: string) {
  c.log.push({ id: uid(), ts: Date.now(), text });
  if (c.log.length > MAX_LOG) c.log.splice(0, c.log.length - MAX_LOG);
}

function findPlayer(c: Campaign, id: string): Player | undefined {
  return c.players.find((p) => p.id === id);
}

function addToTarget(c: Campaign, p: Player, t: Target, gain: number) {
  if (t.type === 'stat') {
    p.stats[t.id] = round4((p.stats[t.id] ?? 0) + gain);
  } else {
    const def = c.abilities.find((a) => a.id === t.id);
    if (!def) return;
    p.abilities[t.id] = clampAbilityXp(def, round4((p.abilities[t.id] ?? 0) + gain), c.rules);
  }
}

function currentXp(p: Player, t: Target): number {
  return t.type === 'stat' ? p.stats[t.id] ?? 0 : p.abilities[t.id] ?? 0;
}

/** Pure: returns a new campaign, or the same object if nothing changed. */
export function reduce(prev: Campaign, action: Action): Campaign {
  const c = structuredClone(prev);
  c.updatedAt = Date.now();

  switch (action.type) {
    case 'award': {
      let changed = false;
      for (const pid of action.playerIds) {
        const p = findPlayer(c, pid);
        if (!p) continue;
        const parts: string[] = [];
        for (const t of action.targets) {
          if (t.type === 'ability') {
            const def = c.abilities.find((a) => a.id === t.id);
            if (!def || !isUnlocked(c, p, def)) continue;
          }
          const mult = multiplier(c, p, t);
          const gain = round4(action.base * mult);
          if (gain === 0) continue;
          addToTarget(c, p, t, gain);
          parts.push(`${targetName(c, t)} +${gain}`);
        }
        if (parts.length) {
          log(c, `${p.name}: ${parts.join(', ')}`);
          changed = true;
        }
      }
      return changed ? c : prev;
    }

    case 'setXp': {
      const p = findPlayer(c, action.playerId);
      if (!p) return prev;
      const xp = Math.max(0, round4(action.xp));
      if (action.target.type === 'stat') p.stats[action.target.id] = xp;
      else {
        const def = c.abilities.find((a) => a.id === action.target.id);
        if (!def) return prev;
        p.abilities[def.id] = clampAbilityXp(def, xp, c.rules);
      }
      log(
        c,
        `${p.name}: ${targetName(c, action.target)} set to ${formatLevel(currentXp(p, action.target), c.rules)} (manual edit)`,
      );
      return c;
    }

    case 'grantSpendable': {
      const names: string[] = [];
      for (const pid of action.playerIds) {
        const p = findPlayer(c, pid);
        if (!p) continue;
        p.spendableXp = Math.max(0, round4(p.spendableXp + action.amount));
        names.push(p.name);
      }
      if (!names.length) return prev;
      log(c, `Spendable XP ${action.amount >= 0 ? '+' : ''}${action.amount}: ${names.join(', ')}`);
      return c;
    }

    case 'spend': {
      const p = findPlayer(c, action.playerId);
      if (!p || action.amount <= 0 || action.amount > p.spendableXp) return prev;
      const t = action.target;
      if (t.type === 'stat') {
        const stat = c.stats.find((s) => s.id === t.id);
        if (!stat || stat.kind === 'primary') return prev; // primary stats can't be bought
      } else {
        const def = c.abilities.find((a) => a.id === t.id);
        if (!def || !isUnlocked(c, p, def)) return prev;
      }
      p.spendableXp = round4(p.spendableXp - action.amount);
      addToTarget(c, p, t, action.amount);
      log(c, `${p.name} spent ${action.amount} XP on ${targetName(c, t)}`);
      return c;
    }

    case 'toggleCombat': {
      c.combat = !c.combat;
      log(c, c.combat ? 'Combat started (3x XP for everyone)' : 'Combat ended');
      return c;
    }

    case 'setFavorite': {
      const p = findPlayer(c, action.playerId);
      if (!p) return prev;
      p.favoriteStatId = action.statId;
      log(c, `${p.name}: favorite stat ${action.statId ? targetName(c, { type: 'stat', id: action.statId }) : 'cleared'}`);
      return c;
    }

    case 'setMisc': {
      const p = findPlayer(c, action.playerId);
      if (!p) return prev;
      if (action.on !== undefined) p.misc.on = action.on;
      if (action.mult !== undefined && action.mult > 0) p.misc.mult = action.mult;
      log(c, `${p.name}: misc boost ${p.misc.on ? `on (${p.misc.mult}x)` : 'off'}`);
      return c;
    }

    case 'setPool': {
      const p = findPlayer(c, action.playerId);
      if (!p) return prev;
      const pool = p[action.pool];
      if (action.max !== undefined) pool.max = Math.max(0, Math.round(action.max));
      if (action.cur !== undefined) pool.cur = Math.round(action.cur);
      pool.cur = Math.max(0, Math.min(pool.cur, pool.max));
      log(c, `${p.name}: ${action.pool === 'ap' ? 'AP' : 'Mana'} ${pool.cur}/${pool.max}`);
      return c;
    }

    case 'addPlayer': {
      const name = action.name.trim() || `Player ${c.players.length + 1}`;
      c.players.push(newPlayer(name));
      log(c, `${name} joined the party`);
      return c;
    }

    case 'removePlayer': {
      const p = findPlayer(c, action.playerId);
      if (!p) return prev;
      c.players = c.players.filter((x) => x.id !== p.id);
      log(c, `${p.name} removed`);
      return c;
    }

    case 'renamePlayer': {
      const p = findPlayer(c, action.playerId);
      const name = action.name.trim();
      if (!p || !name || name === p.name) return prev;
      log(c, `${p.name} renamed to ${name}`);
      p.name = name;
      return c;
    }

    case 'setRace': {
      const p = findPlayer(c, action.playerId);
      if (!p) return prev;
      p.raceId = action.raceId;
      const race = c.races.find((r) => r.id === action.raceId);
      log(c, `${p.name}: race ${race ? race.name : 'cleared'}`);
      return c;
    }

    case 'learn': {
      const p = findPlayer(c, action.playerId);
      const def = c.abilities.find((a) => a.id === action.abilityId);
      if (!p || !def || def.id in p.abilities) return prev;
      p.abilities[def.id] = 0;
      log(c, `${p.name} learned ${def.name}`);
      return c;
    }

    case 'forget': {
      const p = findPlayer(c, action.playerId);
      const def = c.abilities.find((a) => a.id === action.abilityId);
      if (!p || !def || !(def.id in p.abilities)) return prev;
      delete p.abilities[def.id];
      log(c, `${p.name} forgot ${def.name}`);
      return c;
    }

    case 'addStat': {
      const name = action.name.trim();
      if (!name) return prev;
      const id = slug(name, c.stats.map((s) => s.id));
      const parentId =
        action.kind === 'secondary' && c.stats.some((s) => s.id === action.parentId && s.kind === 'primary')
          ? action.parentId
          : undefined;
      c.stats.push({ id, name, kind: action.kind, ...(parentId ? { parentId } : {}) });
      log(c, `New ${action.kind} stat: ${name}`);
      return c;
    }

    case 'addRace': {
      const name = action.name.trim();
      if (!name) return prev;
      c.races.push({ id: slug(name, c.races.map((r) => r.id)), name, notes: '' });
      log(c, `New race: ${name}`);
      return c;
    }

    case 'addAbility': {
      const name = action.def.name.trim();
      if (!name) return prev;
      c.abilities.push({ ...action.def, name, id: slug(name, c.abilities.map((a) => a.id)) });
      log(c, `New ${action.def.kind}: ${name}`);
      return c;
    }

    case 'setRulesText':
      c.rulesText = action.text;
      return c;

    case 'setDice':
      c.rules.dice = action.dice;
      return c;

    case 'renameCampaign': {
      const name = action.name.trim();
      if (!name || name === c.name) return prev;
      c.name = name;
      return c;
    }
  }
}
