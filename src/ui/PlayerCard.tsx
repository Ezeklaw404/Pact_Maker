import type { Campaign, Player } from '../types';
import { formatLevel, statXp } from '../xp';
import { Bar } from './parts';

interface Props {
  c: Campaign;
  p: Player;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

export function PlayerCard({ c, p, selected, onSelect, onOpen }: Props) {
  const primary = c.stats.filter((s) => s.kind === 'primary');
  const race = c.races.find((r) => r.id === p.raceId)?.name;
  const fav = c.stats.find((s) => s.id === p.favoriteStatId)?.name;

  return (
    <article className={`card${c.combat ? ' combat' : ''}${selected ? ' selected' : ''}`} onClick={onOpen}>
      <header>
        <div>
          <h3>{p.name}</h3>
          <small>
            {race ?? 'No race'}
            {fav ? ` · ★ ${fav}` : ''}
            {p.misc.on ? ` · boost ${p.misc.mult}x` : ''}
          </small>
        </div>
        <input
          type="checkbox"
          checked={selected}
          title="Select for group actions"
          onClick={(e) => e.stopPropagation()}
          onChange={onSelect}
        />
      </header>

      <div className="stat-list">
        {primary.map((s) => (
          <div className="mini-row" key={s.id}>
            <span>{s.name}</span>
            <b>{formatLevel(statXp(p, s.id), c.rules)}</b>
            <Bar xp={statXp(p, s.id)} rules={c.rules} />
          </div>
        ))}
      </div>

      <footer>
        <span>
          AP {p.ap.cur}/{p.ap.max}
        </span>
        <span>
          Mana {p.mana.cur}/{p.mana.max}
        </span>
        {p.spendableXp > 0 && <span className="gold">{p.spendableXp} XP to spend</span>}
      </footer>
    </article>
  );
}
