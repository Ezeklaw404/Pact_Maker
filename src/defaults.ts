import type { AbilityDef, Campaign, Player, StatDef } from './types';
import { uid } from './xp';

export const DEFAULT_STATS: StatDef[] = [
  { id: 'strength', name: 'Strength', kind: 'primary' },
  { id: 'dexterity', name: 'Dexterity', kind: 'primary' },
  { id: 'constitution', name: 'Constitution', kind: 'primary' },
  { id: 'intelligence', name: 'Intelligence', kind: 'primary' },
  { id: 'wisdom', name: 'Wisdom', kind: 'primary' },
  { id: 'charisma', name: 'Charisma', kind: 'primary' },
  { id: 'force', name: 'Force', kind: 'secondary', parentId: 'strength' },
  { id: 'steadfast', name: 'Steadfast', kind: 'secondary', parentId: 'strength' },
  { id: 'skill', name: 'Skill', kind: 'secondary', parentId: 'dexterity' },
  { id: 'poise', name: 'Poise', kind: 'secondary', parentId: 'dexterity' },
  { id: 'toughness', name: 'Toughness', kind: 'secondary', parentId: 'constitution' },
  { id: 'stamina', name: 'Stamina', kind: 'secondary', parentId: 'constitution' },
  { id: 'knowledge', name: 'Knowledge', kind: 'secondary', parentId: 'intelligence' },
  { id: 'wit', name: 'Wit', kind: 'secondary', parentId: 'intelligence' },
  { id: 'awareness', name: 'Awareness', kind: 'secondary', parentId: 'wisdom' },
  { id: 'focus', name: 'Focus', kind: 'secondary', parentId: 'wisdom' },
  { id: 'will', name: 'Will', kind: 'secondary', parentId: 'charisma' },
  { id: 'grit', name: 'Grit', kind: 'secondary', parentId: 'charisma' },
];

export const DEFAULT_ABILITIES: AbilityDef[] = [
  {
    id: 'fireball',
    name: 'Fireball',
    kind: 'technique',
    statId: 'strength',
    requires: { will: 4, strength: 2, steadfast: 1 },
    unlock: 'auto',
    apCost: 6,
    manaCost: 10,
    notes:
      'A massive blast of fire scorching everything in the area: Takes 2 rounds to cast, does 20 damage to everything in a 20 ft radius ',
  },
  {
    id: 'strike',
    name: 'Strike',
    kind: 'technique',
    statId: 'dexterity',
    requires: { strength: 1, dexterity: 1 },
    unlock: 'auto',
    apCost: 2,
    manaCost: 0,
    notes: 'A basic strike with the sword. Dmg = 1d6 +force',
  },
  {
    id: 'area',
    name: 'Area',
    kind: 'skill',
    statId: 'charisma',
    requires: {},
    unlock: 'dm',
    apCost: 0,
    manaCost: 0,
    notes: '',
  },
  {
    id: 'double-strike',
    name: 'Double Strike',
    kind: 'technique',
    statId: 'dexterity',
    requires: { strength: 1, dexterity: 3 },
    unlock: 'auto',
    apCost: 3,
    manaCost: 0,
    notes: 'Two swift strikes - dmg = 1d6 + force, across 2 rolls',
  },
  {
    id: 'power-swing',
    name: 'Power swing',
    kind: 'technique',
    statId: 'strength',
    requires: { strength: 1, dexterity: 1 },
    unlock: 'auto',
    apCost: 5,
    manaCost: 0,
    notes: 'Puts everything into a powerful swing: Dmg = (2d6 + force*2)',
  },
  {
    id: 'cleave',
    name: 'Cleave',
    kind: 'technique',
    statId: 'strength',
    requires: { strength: 3, dexterity: 1 },
    unlock: 'auto',
    apCost: 3,
    manaCost: 0,
    notes:
      'A powerful, sweeping stroke that may hit two opponents at once: Dmg = (1d6+Force*2) to two adjacent targets',
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
    hp: { cur: 10, max: 10 },
    ap: { cur: 3, max: 6 },
    mana: { cur: 10, max: 10 },
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
      { id: 'human', name: 'Human', notes: 'Increase all skill growth by 20%' },
      { id: 'elf', name: 'Elf', notes: 'Quadruples mana pool. 20% increase in Will and Skill' },
      {
        id: 'dwarf',
        name: 'Dwarf',
        notes: 'Reduces all damage taken by half and doubles all toughness exp. Increases exp of Favored stat by 20%',
      },
    ],
    abilities: structuredClone(DEFAULT_ABILITIES),
    players: withPlayers ? [newPlayer('Player 1'), newPlayer('Player 2'), newPlayer('Player 3')] : [],
    log: [],
    rulesText: '# House rules\n\nWrite or import your rules here (Markdown or plain text).',
    createdAt: now,
    updatedAt: now,
  };
}
