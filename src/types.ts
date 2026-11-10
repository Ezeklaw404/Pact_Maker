export type StatKind = 'primary' | 'secondary';

export interface StatDef {
  id: string;
  name: string;
  kind: StatKind;
  /** Secondary stats can hang off one primary stat (one primary -> many secondary). */
  parentId?: string;
}

export interface RaceDef {
  id: string;
  name: string;
  notes: string;
}

/** A skill (grows forever) or technique (grows until mastered). */
export interface AbilityDef {
  id: string;
  name: string;
  kind: 'skill' | 'technique';
  /** Main stat this ability is tied to. */
  statId: string;
  /** Minimum whole stat levels, e.g. { force: 4, area: 2, fire: 1 }. */
  requires: Record<string, number>;
  /** 'auto' unlocks when requirements are met; 'dm' must be granted by the DM. */
  unlock: 'auto' | 'dm';
  apCost: number;
  manaCost: number;
  /** Max level. Techniques default to rules.techniqueCap, skills have no cap. */
  cap?: number;
  notes: string;
}

export interface Target {
  type: 'stat' | 'ability';
  id: string;
}

export interface Pool {
  cur: number;
  max: number;
}

export interface Player {
  id: string;
  name: string;
  raceId: string | null;
  /** statId -> total xp */
  stats: Record<string, number>;
  /** learned abilityId -> total xp */
  abilities: Record<string, number>;
  favoriteStatId: string | null;
  misc: { on: boolean; mult: number };
  hp: Pool;
  ap: Pool;
  mana: Pool;
  /** Generic xp the player can spend on secondary stats, skills, techniques. */
  spendableXp: number;
  /** GM-only sheet (monsters, NPCs). Never sent to players. */
  gmOnly?: boolean;
}

export interface Rules {
  /** XP needed for level 0 -> 1. */
  baseXp: number;
  /** Each next level costs this many times more. */
  growth: number;
  techniqueCap: number;
  /** Standard roll, e.g. "3d6". */
  dice: string;
}

export interface LogEntry {
  id: string;
  ts: number;
  text: string;
}

export interface Campaign {
  id: string;
  name: string;
  rules: Rules;
  combat: boolean;
  stats: StatDef[];
  races: RaceDef[];
  abilities: AbilityDef[];
  players: Player[];
  log: LogEntry[];
  rulesText: string;
  createdAt: number;
  updatedAt: number;
}
