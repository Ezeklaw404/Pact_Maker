import { del, get, set } from 'idb-keyval';
import type { Campaign } from './types';

export interface CampaignSummary {
  id: string;
  name: string;
  updatedAt: number;
}

// Saves go to two places: the host PC (shared by every address) and this browser (a backup copy).
// If the host service isn't reachable (plain dev server, or a different device), only the browser copy is used.
const INDEX_KEY = 'pm:index';
const LAST_KEY = 'pm:last';
const SYNCED_KEY = 'pm:synced';
const campaignKey = (id: string) => `pm:campaign:${id}`;

let hostUp = false;

async function host(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(`/api/campaigns${path}`, init);
    // A static server answers unknown paths with the app's HTML; that is not our service.
    if (!(res.headers.get('content-type') ?? '').includes('application/json')) return null;
    return res;
  } catch {
    return null;
  }
}

const putHost = (c: Campaign) =>
  host(`/${encodeURIComponent(c.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c),
  });

async function localIndex(): Promise<CampaignSummary[]> {
  return (await get<CampaignSummary[]>(INDEX_KEY)) ?? [];
}

export async function loadIndex(): Promise<CampaignSummary[]> {
  const local = await localIndex();
  const res = await host('');
  if (!res || !res.ok) {
    hostUp = false;
    return local;
  }
  hostUp = true;
  const remote = (await res.json()) as CampaignSummary[];

  // First time this browser meets the host: send up anything the host doesn't have (or has an older copy of).
  if (!(await get(SYNCED_KEY))) {
    for (const l of local) {
      const r = remote.find((x) => x.id === l.id);
      if (r && r.updatedAt >= l.updatedAt) continue;
      const c = await get<Campaign>(campaignKey(l.id));
      if (c && (await putHost(c))?.ok) {
        if (r) r.updatedAt = l.updatedAt;
        else remote.push(l);
      }
    }
    await set(SYNCED_KEY, true);
  }

  // After that the host is the truth: forget local copies the host no longer has.
  for (const l of local) if (!remote.some((r) => r.id === l.id)) await del(campaignKey(l.id));
  await set(INDEX_KEY, remote);
  return remote;
}

export async function loadCampaign(id: string): Promise<Campaign | undefined> {
  if (hostUp) {
    const res = await host(`/${encodeURIComponent(id)}`);
    if (res?.ok) {
      const c = (await res.json()) as Campaign;
      await set(campaignKey(id), c);
      return c;
    }
  }
  return get<Campaign>(campaignKey(id));
}

export async function saveCampaign(c: Campaign): Promise<CampaignSummary[]> {
  await set(campaignKey(c.id), c);
  if (hostUp) await putHost(c);
  const index = await localIndex();
  const entry = { id: c.id, name: c.name, updatedAt: c.updatedAt };
  const next = index.some((i) => i.id === c.id) ? index.map((i) => (i.id === c.id ? entry : i)) : [...index, entry];
  await set(INDEX_KEY, next);
  return next;
}

export async function deleteCampaign(id: string): Promise<CampaignSummary[]> {
  await del(campaignKey(id));
  if (hostUp) await host(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const next = (await localIndex()).filter((i) => i.id !== id);
  await set(INDEX_KEY, next);
  return next;
}

export async function getLastId(): Promise<string | undefined> {
  return get<string>(LAST_KEY);
}

export async function setLastId(id: string): Promise<void> {
  await set(LAST_KEY, id);
}
