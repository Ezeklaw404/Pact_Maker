import { useState } from 'react';
import type { Action } from '../reducer';
import type { Campaign } from '../types';
import { Modal } from './parts';

interface Props {
  c: Campaign;
  initialPlayers: string[];
  dispatch: (a: Action) => void;
  onClose: () => void;
}

/** Restore some HP, mana and AP for chosen players (or the whole party). */
export function RestModal({ c, initialPlayers, dispatch, onClose }: Props) {
  const [players, setPlayers] = useState(new Set(initialPlayers));
  const [hpPct, setHpPct] = useState(25);
  const [manaPct, setManaPct] = useState(25);
  const [ap, setAp] = useState(0);

  const flip = (id: string) => {
    const next = new Set(players);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPlayers(next);
  };

  return (
    <Modal title="Rest" onClose={onClose}>
      <p className="hint">Restores a share of max HP and mana.</p>
      <div className="chips wrap">
        {c.players.map((p) => (
          <button key={p.id} className={`chip btn${players.has(p.id) ? ' on' : ''}`} onClick={() => flip(p.id)}>
            {p.name}
          </button>
        ))}
        <button className="chip btn" onClick={() => setPlayers(new Set(c.players.map((p) => p.id)))}>
          All
        </button>
      </div>
      <div className="modal-foot">
        <label>
          HP %
          <input type="number" min={0} value={hpPct} onChange={(e) => setHpPct(Number(e.target.value) || 0)} />
        </label>
        <label>
          Mana %
          <input type="number" min={0} value={manaPct} onChange={(e) => setManaPct(Number(e.target.value) || 0)} />
        </label>
        <label>
          AP
          <input type="number" min={0} value={ap} onChange={(e) => setAp(Number(e.target.value) || 0)} />
        </label>
        <button
          className="primary"
          disabled={!players.size}
          onClick={() => {
            dispatch({ type: 'rest', playerIds: [...players], hpPct, manaPct, ap });
            onClose();
          }}
        >
          Rest
        </button>
      </div>
    </Modal>
  );
}
