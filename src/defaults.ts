import type { AbilityDef, Campaign, Player, StatDef } from './types';
import { uid } from './xp';

export const DEFAULT_STATS: StatDef[] = [
  { id: 'force', name: 'Force', kind: 'primary' },
  { id: 'area', name: 'Area', kind: 'primary' },
  { id: 'skill', name: 'Skill', kind: 'primary' },
  { id: 'alacrity', name: 'Alacrity', kind: 'primary' },
  { id: 'poise', name: 'Poise', kind: 'primary' },
  { id: 'toughness', name: 'Toughness', kind: 'primary' },
  { id: 'grit', name: 'Grit', kind: 'primary' },
  { id: 'stamina', name: 'Stamina', kind: 'primary' },
  { id: 'fire', name: 'Fire', kind: 'secondary' },
  { id: 'water', name: 'Water', kind: 'secondary' },
  { id: 'earth', name: 'Earth', kind: 'secondary' },
  { id: 'air', name: 'Air', kind: 'secondary' },
  { id: 'light', name: 'Light', kind: 'secondary' },
  { id: 'dark', name: 'Dark', kind: 'secondary' },
];

export const DEFAULT_ABILITIES: AbilityDef[] = [
  {
    id: 'fireball',
    name: 'Fireball',
    kind: 'technique',
    statId: 'force',
    requires: { force: 4, area: 2, fire: 1 },
    unlock: 'auto',
    apCost: 1,
    manaCost: 5,
    notes: 'Example technique. More force = more damage, more area = bigger blast.',
  },
  {
    id: 'swordsmanship',
    name: 'Swordsmanship',
    kind: 'skill',
    statId: 'skill',
    requires: {},
    unlock: 'dm',
    apCost: 0,
    manaCost: 0,
    notes: 'Example skill. The DM grants skills to players.',
  },
];

export function newPlayer(name: string): Player {
  return {
    id: uid(),
    name,
    raceId: null,
    stats: {},
    abilities: {},
    favoriteStatId: null,
    misc: { on: false, mult: 1.5 },
    ap: { cur: 0, max: 0 },
    mana: { cur: 0, max: 0 },
    spendableXp: 0,
  };
}

export function newCampaign(name = 'New Campaign', withPlayers = false): Campaign {
  const now = Date.now();
  return {
    id: uid(),
    name,
    rules: { baseXp: 10, growth: 2, techniqueCap: 5, dice: '3d6' },
    combat: false,
    stats: structuredClone(DEFAULT_STATS),
    races: [
      { id: 'human', name: 'Human', notes: '' },
      { id: 'elf', name: 'Elf', notes: '' },
    ],
    abilities: structuredClone(DEFAULT_ABILITIES),
    players: withPlayers ? [newPlayer('Player 1'), newPlayer('Player 2'), newPlayer('Player 3')] : [],
    log: [],
    rulesText: '# House rules\n\nWrite or import your rules here (Markdown or plain text).',
    createdAt: now,
    updatedAt: now,
  };
}
