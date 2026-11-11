import type { ReactNode } from 'react';
import type { Player } from '../types';
import { PoolBtns } from './PoolBtns';

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

export type PoolKey = 'hp' | 'ap' | 'mana';

function Row({ children, btns }: { children: ReactNode; btns?: ReactNode }) {
  return (
    <div className="vital-row">
      {children}
      {btns}
    </div>
  );
}

/** HP, mana and AP. Pass onPool to add − / + (and max, with canMax) beside each and make AP dots clickable. */
export function Vitals({
  p,
  onPool,
  canMax = false,
}: {
  p: Player;
  onPool?: (pool: PoolKey, cur?: number, max?: number) => void;
  canMax?: boolean;
}) {
  const btns = (k: PoolKey) =>
    onPool && <PoolBtns pool={p[k]} canMax={canMax} steps={k !== 'ap'} onChange={(cur, max) => onPool(k, cur, max)} />;
  return (
    <div className="vitals">
      <Row btns={btns('hp')}>
        <PoolBar kind="hp" label="HP" cur={p.hp.cur} max={p.hp.max} />
      </Row>
      <Row btns={btns('mana')}>
        <PoolBar kind="mana" label="Mana" cur={p.mana.cur} max={p.mana.max} />
      </Row>
      <Row btns={btns('ap')}>
        <div className="ap" aria-label={`AP ${p.ap.cur} of ${p.ap.max}`}>
          {Array.from({ length: p.ap.max }, (_, i) => {
            const on = i < p.ap.cur;
            const cls = `ap-dot${on ? ' on' : ''}`;
            return onPool ? (
              <button
                key={i}
                className={cls}
                title="AP"
                onClick={() => onPool('ap', on && i === p.ap.cur - 1 ? i : i + 1)}
              />
            ) : (
              <span key={i} className={cls} />
            );
          })}
        </div>
      </Row>
    </div>
  );
}
