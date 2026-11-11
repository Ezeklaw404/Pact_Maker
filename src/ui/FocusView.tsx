import { useState } from 'react';
import { gmDecide } from '../host';
import type { PlayerRequest } from '../protocol';
import type { Action } from '../reducer';
import type { Campaign, Player } from '../types';
import { viewFor } from '../view';
import { PlayerSheet } from './PlayerSheet';

interface Props {
  c: Campaign;
  p: Player;
  dispatch: (a: Action) => void;
  onBack: () => void;
  onToast: (msg: string) => void;
}

export function FocusView({ c, p, dispatch, onBack, onToast }: Props) {
  const [name, setName] = useState(p.name);
  const view = { ...viewFor(c, null), abilities: c.abilities, me: p };

  const request = (req: PlayerRequest) => {
    const d = gmDecide(c, p, req);
    if (d.ok) dispatch(d.action);
    else onToast(d.reason);
  };

  return (
    <section className="focus">
      <div className="focus-head">
        <button onClick={onBack}>← All players</button>
        <input
          className="name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => (name.trim() ? dispatch({ type: 'renamePlayer', playerId: p.id, name }) : setName(p.name))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <button
          className="danger"
          onClick={() => {
            if (window.confirm(`Remove ${p.name} from this campaign?`)) {
              dispatch({ type: 'removePlayer', playerId: p.id });
              onBack();
            }
          }}
        >
          Remove
        </button>
      </div>

      <div className="panel settings">
        <label>
          Race
          <select value={p.raceId ?? ''} onChange={(e) => dispatch({ type: 'setRace', playerId: p.id, raceId: e.target.value || null })}>
            <option value="">None</option>
            {c.races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Favorite stat (2x)
          <select value={p.favoriteStatId ?? ''} onChange={(e) => dispatch({ type: 'setFavorite', playerId: p.id, statId: e.target.value || null })}>
            <option value="">None</option>
            {c.stats
              .filter((s) => s.kind === 'primary')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <label className="inline">
          <input type="checkbox" checked={p.misc.on} onChange={(e) => dispatch({ type: 'setMisc', playerId: p.id, on: e.target.checked })} />
          Misc boost
          <input
            key={p.misc.mult}
            type="number"
            step="0.1"
            min={0.1}
            defaultValue={p.misc.mult}
            onBlur={(e) => dispatch({ type: 'setMisc', playerId: p.id, mult: Number(e.target.value) })}
          />
          x
        </label>
      </div>

      <PlayerSheet
        view={view}
        p={p}
        permission="admin"
        onRequest={request}
        onToast={onToast}
        gm={{
          onLearn: (abilityId) => dispatch({ type: 'learn', playerId: p.id, abilityId }),
          onForget: (abilityId) => dispatch({ type: 'forget', playerId: p.id, abilityId }),
        }}
      />
    </section>
  );
}
