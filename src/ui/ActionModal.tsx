import { useState } from 'react';
import type { Action } from '../reducer';
import type { Campaign } from '../types';
import { fromKey, keyOf, Modal } from './parts';

interface Props {
  c: Campaign;
  initialPlayers: string[];
  dispatch: (a: Action) => void;
  onClose: () => void;
}

function toggle(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Award xp to several players and several stats/skills/techniques at once. */
export function ActionModal({ c, initialPlayers, dispatch, onClose }: Props) {
  const [players, setPlayers] = useState(new Set(initialPlayers));
  const [targets, setTargets] = useState(new Set<string>());
  const [base, setBase] = useState(1);

  const groups = [
    {
      label: 'Primary stats',
      items: c.stats
        .filter((s) => s.kind === 'primary')
        .map((s) => ({ key: keyOf({ type: 'stat', id: s.id }), name: s.name })),
    },
    {
      label: 'Secondary stats',
      items: c.stats
        .filter((s) => s.kind === 'secondary')
        .map((s) => ({ key: keyOf({ type: 'stat', id: s.id }), name: s.name })),
    },
    {
      label: 'Skills',
      items: c.abilities
        .filter((a) => a.kind === 'skill')
        .map((a) => ({ key: keyOf({ type: 'ability', id: a.id }), name: a.name })),
    },
    {
      label: 'Techniques',
      items: c.abilities
        .filter((a) => a.kind === 'technique')
        .map((a) => ({ key: keyOf({ type: 'ability', id: a.id }), name: a.name })),
    },
  ].filter((g) => g.items.length);

  const apply = () => {
    dispatch({ type: 'award', playerIds: [...players], targets: [...targets].map(fromKey), base });
    onClose();
  };

  return (
    <Modal title="Perform action" onClose={onClose}>
      <p className="hint">
        Pick who acted and what they used. Each gets {base} XP × their modifiers
        {c.combat ? ' (combat 3x is on)' : ''}. Locked skills and techniques are skipped.
      </p>

      <h4>Players</h4>
      <div className="chips wrap">
        {c.players.map((p) => (
          <button
            key={p.id}
            className={`chip btn${players.has(p.id) ? ' on' : ''}`}
            onClick={() => setPlayers(toggle(players, p.id))}
          >
            {p.name}
          </button>
        ))}
        <button className="chip btn" onClick={() => setPlayers(new Set(c.players.map((p) => p.id)))}>
          All
        </button>
      </div>

      {groups.map((g) => (
        <div key={g.label}>
          <h4>{g.label}</h4>
          <div className="chips wrap">
            {g.items.map((it) => (
              <button
                key={it.key}
                className={`chip btn${targets.has(it.key) ? ' on' : ''}`}
                onClick={() => setTargets(toggle(targets, it.key))}
              >
                {it.name}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="modal-foot">
        <label>
          Base XP
          <input
            type="number"
            min={0}
            step="any"
            value={base}
            onChange={(e) => setBase(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <button className="primary" disabled={!players.size || !targets.size || base <= 0} onClick={apply}>
          Apply to {players.size} player{players.size === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  );
}
