import type { Player } from '../types';

function PoolBar({ kind, label, cur, max }: { kind: 'hp' | 'mana'; label: string; cur: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  return (
    <div className={`pool-bar ${kind}`} title={label}>
      <div className="pool-fill" style={{ width: `${pct}%` }} />
      <span className="pool-text">
        {label} {cur}/{max}
      </span>
    </div>
  );
}

/** HP bar, mana bar and AP circles. Pass onAp to make the circles clickable (GM view). */
export function Vitals({ p, onAp }: { p: Player; onAp?: (cur: number) => void }) {
  return (
    <div className="vitals">
      <PoolBar kind="hp" label="HP" cur={p.hp.cur} max={p.hp.max} />
      <PoolBar kind="mana" label="Mana" cur={p.mana.cur} max={p.mana.max} />
      <div className="ap" aria-label={`AP ${p.ap.cur} of ${p.ap.max}`}>
        {Array.from({ length: p.ap.max }, (_, i) => {
          const on = i < p.ap.cur;
          const cls = `ap-dot${on ? ' on' : ''}`;
          return onAp ? (
            <button key={i} className={cls} title="AP" onClick={() => onAp(on && i === p.ap.cur - 1 ? i : i + 1)} />
          ) : (
            <span key={i} className={cls} />
          );
        })}
      </div>
    </div>
  );
}
