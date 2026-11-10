import type { Pool } from '../types';

/** − / + for the current value, plus an optional box for the maximum. */
export function PoolCtl({
  label,
  pool,
  onChange,
  canMax = true,
}: {
  label: string;
  pool: Pool;
  onChange: (cur?: number, max?: number) => void;
  canMax?: boolean;
}) {
  return (
    <div className="pool">
      <span>{label}</span>
      <button onClick={() => onChange(pool.cur - 1)}>−</button>
      <b>
        {pool.cur}/{pool.max}
      </b>
      <button onClick={() => onChange(pool.cur + 1)}>+</button>
      {canMax && (
        <label className="muted">
          max
          <input
            key={pool.max}
            type="number"
            min={0}
            defaultValue={pool.max}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v !== pool.max) onChange(undefined, v);
            }}
          />
        </label>
      )}
    </div>
  );
}
