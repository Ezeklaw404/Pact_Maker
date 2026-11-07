import type { AbilityDef, Campaign, Player, RaceDef, Rules, StatDef } from './types';

export interface PlayerSummary {
  id: string;
  name: string;
  raceId: string | null;
}

/** Everything a connected player is allowed to see. */
export interface PlayerView {
  campaignName: string;
  rules: Rules;
  combat: boolean;
  stats: StatDef[];
  races: RaceDef[];
  abilities: AbilityDef[];
  rulesText: string;
  me: Player | null; // their own full sheet
  others: PlayerSummary[]; // everyone else: name + race only
}

export function viewFor(c: Campaign, playerId: string | null): PlayerView {
  const visible = c.players.filter((p) => !p.gmOnly);
  const me = visible.find((p) => p.id === playerId) ?? null;
  return {
    campaignName: c.name,
    rules: c.rules,
    combat: c.combat,
    stats: c.stats,
    races: c.races,
    // Auto-unlock abilities show as goals; DM-granted ones only appear once you own them.
    abilities: c.abilities.filter((a) => a.unlock === 'auto' || (me !== null && a.id in me.abilities)),
    rulesText: c.rulesText,
    me,
    others: visible.filter((p) => p.id !== playerId).map((p) => ({ id: p.id, name: p.name, raceId: p.raceId })),
  };
}
