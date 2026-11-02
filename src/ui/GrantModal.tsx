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

/** Hand out generic spendable xp (e.g. end of session). */
export function GrantModal({ c, initialPlayers, dispatch, onClose }: Props) {
  const [players, setPlayers] = useState(new Set(initialPlayers));
  const [amount, setAmount] = useState(10);

  const flip = (id: string) => {
    const next = new Set(players);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPlayers(next);
  };

  return (
    <Modal title="Grant spendable XP" onClose={onClose}>
      <p className="hint">
        Players spend this on secondary stats, skills and techniques (not primary stats). Modifiers do not apply.
      </p>
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
          XP each
          <input type="number" step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
        </label>
        <button
          className="primary"
          disabled={!players.size || amount === 0}
          onClick={() => {
            dispatch({ type: 'grantSpendable', playerIds: [...players], amount });
            onClose();
          }}
        >
          Grant
        </button>
      </div>
    </Modal>
  );
}
