export interface SpendInfo {
  onSpend: () => void;
  room: number;
}

export function SpendSlot({ spend }: { spend?: SpendInfo | null }) {
  return (
    <span className="spend-slot">
      {spend && (
        <button className="spend" title="Spend 1 point" onClick={spend.onSpend}>
          +1
        </button>
      )}
    </span>
  );
}

export function Level({ now, next }: { now: string; next?: string }) {
  if (!next) return <>{now}</>;
  return (
    <span className="lv">
      <span className="lv-now">{now}</span>
      <span className="lv-next">{next}</span>
    </span>
  );
}
