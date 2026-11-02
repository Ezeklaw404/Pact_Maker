import { del, get, set } from 'idb-keyval';
import type { Campaign } from './types';

export interface CampaignSummary {
  id: string;
  name: string;
  updatedAt: number;
}

const INDEX_KEY = 'pm:index';
const LAST_KEY = 'pm:last';
const campaignKey = (id: string) => `pm:campaign:${id}`;

export async function loadIndex(): Promise<CampaignSummary[]> {
  return (await get<CampaignSummary[]>(INDEX_KEY)) ?? [];
}

export async function loadCampaign(id: string): Promise<Campaign | undefined> {
  return get<Campaign>(campaignKey(id));
}

export async function saveCampaign(c: Campaign): Promise<CampaignSummary[]> {
  await set(campaignKey(c.id), c);
  const index = await loadIndex();
  const entry = { id: c.id, name: c.name, updatedAt: c.updatedAt };
  const next = index.some((i) => i.id === c.id)
    ? index.map((i) => (i.id === c.id ? entry : i))
    : [...index, entry];
  await set(INDEX_KEY, next);
  return next;
}

export async function deleteCampaign(id: string): Promise<CampaignSummary[]> {
  await del(campaignKey(id));
  const next = (await loadIndex()).filter((i) => i.id !== id);
  await set(INDEX_KEY, next);
  return next;
}

export async function getLastId(): Promise<string | undefined> {
  return get<string>(LAST_KEY);
}

export async function setLastId(id: string): Promise<void> {
  await set(LAST_KEY, id);
}
