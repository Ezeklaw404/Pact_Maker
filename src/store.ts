import { useCallback, useEffect, useRef, useState } from 'react';
import { newCampaign } from './defaults';
import { commit, createHistory, redo as redoH, undo as undoH, type History } from './history';
import { importCampaign } from './portable';
import { reduce, type Action } from './reducer';
import { migrate } from './migrate';
import {
  deleteCampaign,
  getLastId,
  loadCampaign,
  loadIndex,
  saveCampaign,
  setLastId,
  type CampaignSummary,
} from './storage';
import type { Campaign } from './types';

export function useStore() {
  const [hist, setHist] = useState<History<Campaign> | null>(null);
  const [index, setIndex] = useState<CampaignSummary[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // First load: reopen the last campaign, or make a starter one.
  useEffect(() => {
    (async () => {
      try {
        navigator.storage?.persist?.();
      } catch {
        /* optional */
      }
      const idx = await loadIndex();
      const lastId = await getLastId();
      const wanted = idx.find((i) => i.id === lastId) ?? idx[0];
      const loaded = wanted ? await loadCampaign(wanted.id) : undefined;
      setHist(createHistory(loaded ? migrate(loaded) : newCampaign('My Campaign')));
      setIndex(idx);
    })();
  }, []);

  // Save shortly after every change.
  const present = hist?.present;
  useEffect(() => {
    if (!present) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveCampaign(present).then(setIndex);
      setLastId(present.id);
    }, 250);
    return () => clearTimeout(saveTimer.current);
  }, [present]);

  const dispatch = useCallback((a: Action) => {
    setHist((h) => (h ? commit(h, reduce(h.present, a)) : h));
  }, []);
  const undo = useCallback(() => setHist((h) => (h ? undoH(h) : h)), []);
  const redo = useCallback(() => setHist((h) => (h ? redoH(h) : h)), []);

  /** Switch campaigns; history starts fresh (undo is session-only per campaign). */
  const open = useCallback(async (id: string) => {
    const c = await loadCampaign(id);
    if (c) setHist(createHistory(migrate(c)));
  }, []);

  const create = useCallback((name: string) => {
    setHist(createHistory(newCampaign(name.trim() || 'New Campaign')));
  }, []);

  const importText = useCallback((text: string) => {
    setHist(createHistory(importCampaign(text)));
  }, []);

  const remove = useCallback(
    async (id: string) => {
      const next = await deleteCampaign(id);
      setIndex(next);
      if (present?.id === id) {
        if (next[0]) await open(next[0].id);
        else setHist(createHistory(newCampaign('My Campaign')));
      }
    },
    [open, present?.id],
  );

  return {
    campaign: present,
    index,
    canUndo: !!hist?.past.length,
    canRedo: !!hist?.future.length,
    dispatch,
    undo,
    redo,
    open,
    create,
    remove,
    importText,
  };
}
