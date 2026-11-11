import type { ReactNode } from 'react';
import { rollDice } from '../dice';
import type { Permission, PlayerRequest } from '../protocol';
import type { AbilityDef, Player, StatDef, Target } from '../types';
import type { PlayerView } from '../view';
import {
  abilityCap,
  canSpendOn,
  formatLevel,
  isMastered,
  isUnlocked,
  multiplier,
  SPEND_AMOUNT,
  spendPreview,
  spendRoom,
  statLevel,
  statXp,
  targetName,
} from '../xp';
import { Bar } from './parts';
import { Level, SpendSlot, type SpendInfo } from './Spend';
import { Vitals } from './Vitals';

export interface GmTools {
  onLearn: (abilityId: string) => void;
  onForget: (abilityId: string) => void;
}

interface Props {
  view: PlayerView;
  p: Player;
  permission: Permission;
  onRequest: (req: PlayerRequest) => void;
  onToast: (msg: string) => void;
  head?: ReactNode;
  gm?: GmTools;
}

interface RowProps {
  name: string;
  xp: number;
  view: PlayerView;
  mult: number;
  indent?: boolean;
  full?: boolean;
  badge?: string;
  sub?: string;
  canAdd: boolean;
  onAdd: () => void;
  onEdit?: () => void;
  spend?: SpendInfo | null;
  spendSlot?: boolean;
  onRoll: () => void;
  extra?: ReactNode;
}

function Row(r: RowProps) {
  const preview = r.spend ? spendPreview(r.xp, r.spend.room, r.view.rules, r.mult) : null;
  const label = formatLevel(r.xp, r.view.rules);
  return (
    <div className={`row${r.indent ? ' indent' : ''}`}>
      {r.spendSlot && <SpendSlot spend={r.spend} />}
      <div className="row-main">
        <div className="row-top">
          <span className="row-name">
            {r.name}
            {r.badge && <em className="badge">{r.badge}</em>}
            {r.mult > 1 && <em className="mult">×{r.mult}</em>}
          </span>
          {r.onEdit ? (
            <button className="level" onClick={r.onEdit} title="Click to edit manually">
              <Level now={label} next={preview?.label} />
            </button>
          ) : (
            <b className="level-num">
              <Level now={label} next={preview?.label} />
            </b>
          )}
        </div>
        <Bar xp={r.xp} rules={r.view.rules} full={r.full} ghost={preview} />
        {r.sub && <small className="muted">{r.sub}</small>}
      </div>
      <div className="row-btns">
        {r.canAdd && (
          <button onClick={r.onAdd} title="+1 XP with modifiers">
            +1
          </button>
        )}
        <button onClick={r.onRoll} title="Roll">
          🎲
        </button>
        {r.extra}
      </div>
    </div>
  );
}

export function PlayerSheet({ view, p, permission, onRequest, onToast, head, gm }: Props) {
  const canAdd = permission === 'admin';
  const canEdit = permission !== 'view';
  const spendSlot = canEdit && p.spendableXp >= SPEND_AMOUNT;

  const award = (targets: Target[]) => onRequest({ type: 'award', targets });
  const pool = (k: 'hp' | 'ap' | 'mana', cur?: number, max?: number) => onRequest({ type: 'pool', pool: k, cur, max });
  const edit = (t: Target, xp: number) => {
    const v = window.prompt(`Set ${targetName(view, t)} level (example: 4.05)`, formatLevel(xp, view.rules));
    const n = v === null ? NaN : parseFloat(v);
    if (Number.isFinite(n) && n >= 0) onRequest({ type: 'setLevel', target: t, level: n });
  };
  const spendFor = (t: Target, xp: number): SpendInfo | null =>
    spendSlot && canSpendOn(view, p, t)
      ? { onSpend: () => onRequest({ type: 'spend', target: t }), room: spendRoom(view, t, xp) }
      : null;

  const roll = (t: Target) => {
    const statId = t.type === 'stat' ? t.id : view.abilities.find((a) => a.id === t.id)?.statId;
    const bonus = statId ? statLevel(p, statId, view.rules) : 0;
    const r = rollDice(view.rules.dice, bonus);
    onToast(
      r
        ? `${targetName(view, t)}: ${view.rules.dice} [${r.rolls.join(', ')}] + ${r.mod} = ${r.total}`
        : 'The dice setting is not valid.',
    );
  };

  const statRow = (s: StatDef, indent = false) => {
    const t: Target = { type: 'stat', id: s.id };
    const xp = statXp(p, s.id);
    return (
      <Row
        key={s.id}
        name={s.name}
        xp={xp}
        view={view}
        mult={multiplier(view, p, t)}
        indent={indent}
        canAdd={canAdd}
        onAdd={() => award([t])}
        onEdit={canAdd ? () => edit(t, xp) : undefined}
        spend={spendFor(t, xp)}
        spendSlot={spendSlot}
        onRoll={() => roll(t)}
      />
    );
  };

  const abilityRow = (a: AbilityDef) => {
    const t: Target = { type: 'ability', id: a.id };
    const xp = p.abilities[a.id] ?? 0;
    const mastered = isMastered(a, xp, view.rules);
    const cap = abilityCap(a, view.rules);
    const cost = [a.apCost ? `${a.apCost} AP` : '', a.manaCost ? `${a.manaCost} mana` : ''].filter(Boolean).join(' · ');
    return (
      <Row
        key={a.id}
        name={a.name}
        xp={xp}
        view={view}
        full={mastered}
        badge={mastered ? 'Mastered' : undefined}
        sub={[targetName(view, { type: 'stat', id: a.statId }), cost, cap ? `max level ${cap}` : ''].filter(Boolean).join(' · ')}
        mult={multiplier(view, p, t)}
        canAdd={canAdd}
        onAdd={() => award([t])}
        onEdit={canAdd ? () => edit(t, xp) : undefined}
        spend={spendFor(t, xp)}
        spendSlot={spendSlot}
        onRoll={() => roll(t)}
        extra={
          gm && a.unlock === 'dm' ? (
            <button className="danger" title="Remove from player" onClick={() => gm.onForget(a.id)}>
              ✕
            </button>
          ) : undefined
        }
      />
    );
  };

  const reqText = (a: AbilityDef) =>
    Object.entries(a.requires)
      .map(([id, n]) => `${targetName(view, { type: 'stat', id })} ${n}`)
      .join(', ') || 'no requirements';

  const primary = view.stats.filter((s) => s.kind === 'primary');
  const loose = view.stats.filter((s) => s.kind === 'secondary' && !view.stats.some((x) => x.id === s.parentId));
  const unlocked = view.abilities.filter((a) => isUnlocked(view, p, a));
  const locked = view.abilities.filter((a) => a.unlock === 'auto' && !isUnlocked(view, p, a));
  const grantable = gm ? view.abilities.filter((a) => a.unlock === 'dm' && !(a.id in p.abilities)) : [];
  const skills = unlocked.filter((a) => a.kind === 'skill');
  const techniques = unlocked.filter((a) => a.kind === 'technique');

  return (
    <>
      <div className="panel">
        {head}
        <Vitals p={p} canMax={canAdd} onPool={canEdit ? pool : undefined} />
        <div className="pool xp-row">
          <span>Spendable XP</span>
          <b className="gold">{p.spendableXp}</b>
        </div>
      </div>

      <div className="panel">
        <h4>Stats</h4>
        {primary.map((s) => (
          <div key={s.id}>
            {statRow(s)}
            {view.stats.filter((x) => x.parentId === s.id).map((x) => statRow(x, true))}
          </div>
        ))}
        {loose.length > 0 && <h5>Secondary stats</h5>}
        {loose.map((s) => statRow(s))}
      </div>

      <div className="panel">
        <h4>Skills</h4>
        {skills.map(abilityRow)}
        {!skills.length && <p className="muted">No skills yet.</p>}
        <h4>Techniques</h4>
        {techniques.map(abilityRow)}
        {!techniques.length && <p className="muted">No techniques unlocked yet.</p>}
        {(locked.length > 0 || grantable.length > 0) && <h5>Locked</h5>}
        {locked.map((a) => (
          <div className="locked" key={a.id}>
            <span>
              🔒 <b>{a.name}</b> <span className="muted">needs {reqText(a)}</span>
            </span>
          </div>
        ))}
        {grantable.map((a) => (
          <div className="locked" key={a.id}>
            <span>
              <b>{a.name}</b> <span className="muted">({a.kind}, DM grants)</span>
            </span>
            <button onClick={() => gm?.onLearn(a.id)}>Grant</button>
          </div>
        ))}
      </div>
    </>
  );
}
