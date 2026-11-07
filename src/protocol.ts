import type { Target } from './types';
import type { PlayerView } from './view';

/** v1 has two levels. More (edit own sheet, edit any sheet) come when there is something to edit. */
export type Permission = 'view' | 'xp';

/**
 * What a player may ask the host to do. Players never send reducer Actions:
 * the host turns an allowed request into an Action itself.
 */
export type PlayerRequest = { type: 'award'; targets: Target[] };

export type ToHost = { k: 'req'; req: PlayerRequest };

export type ToPlayer = { k: 'view'; view: PlayerView; permission: Permission } | { k: 'notice'; text: string };
