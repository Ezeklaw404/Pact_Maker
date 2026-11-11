import type { Target } from './types';
import type { PlayerView } from './view';

/** view = look only. edit = change own HP/Mana/AP (default). admin = also XP and maximums. */
export type Permission = 'view' | 'edit' | 'admin';

export type PlayerRequest =
  | { type: 'award'; targets: Target[] }
  | { type: 'pool'; pool: 'hp' | 'ap' | 'mana'; cur?: number; max?: number }
  | { type: 'setLevel'; target: Target; level: number }
  | { type: 'spend'; target: Target };

export type ToHost = { k: 'req'; req: PlayerRequest };

export type ToPlayer = { k: 'view'; view: PlayerView; permission: Permission } | { k: 'notice'; text: string };
