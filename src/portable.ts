import type { Campaign } from './types';
import { uid } from './xp';
import { migrate } from './migrate';

export function exportCampaign(c: Campaign): string {
  return JSON.stringify({ app: 'pact-maker', version: 1, campaign: c }, null, 2);
}

/** Parses an exported file. Always gets a fresh id so it never overwrites an existing campaign. */
export function importCampaign(text: string): Campaign {
  const data = JSON.parse(text);
  const c = data?.app === 'pact-maker' ? data.campaign : data;
  const ok =
    c &&
    typeof c.name === 'string' &&
    c.rules &&
    Array.isArray(c.stats) &&
    Array.isArray(c.players) &&
    Array.isArray(c.abilities) &&
    Array.isArray(c.races);
  if (!ok) throw new Error('This file is not a Pact Maker campaign.');
  return migrate({ ...c, id: uid(), log: Array.isArray(c.log) ? c.log : [], rulesText: c.rulesText ?? '' } as Campaign);
}
