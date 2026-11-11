import type { Pool } from '../types';

export function PoolBtns({
  pool,
  onChange,
  canMax = true,
  steps = true,
}: {
  pool: Pool;
  onChange: (cur?: number, max?: number) => void;
  canMax?: boolean;
  steps?: boolean;
}) {
  return (
    <div className="pool-btns">
      {steps && (
        <>
          <button onClick={() => onChange(pool.cur - 1)}>−</button>
          <button onClick={() => onChange(pool.cur + 1)}>+</button>
        </>
      )}
      {canMax && (
        <label className="max-box">
          <span>max</span>
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
