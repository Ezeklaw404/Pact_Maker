import { useState, type ReactNode } from 'react';
import { rollDice } from '../dice';
import type { Action } from '../reducer';
import { Vitals } from './Vitals';
import { PoolCtl } from './PoolCtl';
import type { AbilityDef, Campaign, Player, StatDef, Target } from '../types';
import {
  abilityCap,
  formatLevel,
  isMastered,
  isUnlocked,
  levelToXp,
  multiplier,
  statLevel,
  statXp,
  targetName,
} from '../xp';
import { Bar, fromKey, keyOf } from './parts';

interface Props {
  c: Campaign;
  p: Player;
  dispatch: (a: Action) => void;
  onBack: () => void;
  onToast: (msg: string) => void;
}

interface RowProps {
  name: string;
  xp: number;
  c: Campaign;
  mult: number;
  checked: boolean;
  full?: boolean;
  badge?: string;
  sub?: string;
  onCheck: () => void;
  onPlus: () => void;
  onRoll: () => void;
  onEdit: () => void;
  indent?: boolean;
  extra?: ReactNode;
}

function Row(r: RowProps) {
  return (
    <div className={`row${r.indent ? ' indent' : ''}`}>
      <input type="checkbox" checked={r.checked} onChange={r.onCheck} title="Select for action" />
      <div className="row-main">
        <div className="row-top">
          <span className="row-name">
            {r.name}
            {r.badge && <em className="badge">{r.badge}</em>}
            {r.mult > 1 && <em className="mult">×{r.mult}</em>}
          </span>
          <button className="level" onClick={r.onEdit} title="Click to edit manually">
            {formatLevel(r.xp, r.c.rules)}
          </button>
        </div>
        <Bar xp={r.xp} rules={r.c.rules} full={r.full} />
        {r.sub && <small className="muted">{r.sub}</small>}
      </div>
      <div className="row-btns">
        <button onClick={r.onPlus} title="+1 XP with modifiers">
          +1
        </button>
        <button onClick={r.onRoll} title="Roll">
          🎲
        </button>
        {r.extra}
      </div>
    </div>
  );
}

export function FocusView({ c, p, dispatch, onBack, onToast }: Props) {
  const [picked, setPicked] = useState(new Set<string>());
  const [spendKey, setSpendKey] = useState('');
  const [spendAmt, setSpendAmt] = useState(1);
  const [name, setName] = useState(p.name);

  const flip = (t: Target) => {
    const k = keyOf(t);
    const next = new Set(picked);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setPicked(next);
  };

  const award = (targets: Target[]) => dispatch({ type: 'award', playerIds: [p.id], targets, base: 1 });

  const roll = (t: Target) => {
    const statId = t.type === 'stat' ? t.id : c.abilities.find((a) => a.id === t.id)?.statId;
    const bonus = statId ? statLevel(p, statId, c.rules) : 0;
    const r = rollDice(c.rules.dice, bonus);
    if (!r) return onToast('Dice setting is not valid. Fix it in the menu.');
    onToast(`${p.name} · ${targetName(c, t)}: ${c.rules.dice} [${r.rolls.join(', ')}] + ${r.mod} = ${r.total}`);
  };

  const edit = (t: Target, xp: number) => {
    const v = window.prompt(`Set ${targetName(c, t)} level (example: 4.05)`, formatLevel(xp, c.rules));
    const n = v === null ? NaN : parseFloat(v);
    if (Number.isFinite(n) && n >= 0) dispatch({ type: 'setXp', playerId: p.id, target: t, xp: levelToXp(n, c.rules) });
  };

  const statRow = (s: StatDef, indent = false) => {
    const t: Target = { type: 'stat', id: s.id };
    const xp = statXp(p, s.id);
    return (
      <Row
        key={s.id}
        c={c}
        name={s.name}
        xp={xp}
        indent={indent}
        mult={multiplier(c, p, t)}
        checked={picked.has(keyOf(t))}
        onCheck={() => flip(t)}
        onPlus={() => award([t])}
        onRoll={() => roll(t)}
        onEdit={() => edit(t, xp)}
      />
    );
  };

  const abilityRow = (a: AbilityDef) => {
    const t: Target = { type: 'ability', id: a.id };
    const xp = p.abilities[a.id] ?? 0;
    const mastered = isMastered(a, xp, c.rules);
    const cap = abilityCap(a, c.rules);
    const cost = [a.apCost ? `${a.apCost} AP` : '', a.manaCost ? `${a.manaCost} mana` : ''].filter(Boolean).join(' · ');
    return (
      <Row
        key={a.id}
        c={c}
        name={a.name}
        xp={xp}
        full={mastered}
        badge={mastered ? 'Mastered' : undefined}
        sub={[targetName(c, { type: 'stat', id: a.statId }), cost, cap ? `max level ${cap}` : '']
          .filter(Boolean)
          .join(' · ')}
        mult={multiplier(c, p, t)}
        checked={picked.has(keyOf(t))}
        onCheck={() => flip(t)}
        onPlus={() => award([t])}
        onRoll={() => roll(t)}
        onEdit={() => edit(t, xp)}
        extra={
          a.unlock === 'dm' ? (
            <button
              className="danger"
              title="Remove from player"
              onClick={() => dispatch({ type: 'forget', playerId: p.id, abilityId: a.id })}
            >
              ✕
            </button>
          ) : undefined
        }
      />
    );
  };

  const primary = c.stats.filter((s) => s.kind === 'primary');
  const loose = c.stats.filter((s) => s.kind === 'secondary' && !c.stats.some((x) => x.id === s.parentId));
  const unlocked = c.abilities.filter((a) => isUnlocked(c, p, a));
  const lockedAuto = c.abilities.filter((a) => a.unlock === 'auto' && !isUnlocked(c, p, a));
  const grantable = c.abilities.filter((a) => a.unlock === 'dm' && !(a.id in p.abilities));

  const reqText = (a: AbilityDef) =>
    Object.entries(a.requires)
      .map(([id, n]) => `${targetName(c, { type: 'stat', id })} ${n}`)
      .join(', ') || 'no requirements';

  const spendOptions = [
    ...c.stats
      .filter((s) => s.kind === 'secondary')
      .map((s) => ({ key: keyOf({ type: 'stat', id: s.id }), name: s.name })),
    ...unlocked.map((a) => ({ key: keyOf({ type: 'ability', id: a.id }), name: a.name })),
  ];

  const pickedTargets = [...picked].map(fromKey);

  return (
    <section className="focus">
      <div className="focus-head">
        <button onClick={onBack}>← All players</button>
        <input
          className="name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => (name.trim() ? dispatch({ type: 'renamePlayer', playerId: p.id, name }) : setName(p.name))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <button
          className="danger"
          onClick={() => {
            if (window.confirm(`Remove ${p.name} from this campaign?`)) {
              dispatch({ type: 'removePlayer', playerId: p.id });
              onBack();
            }
          }}
        >
          Remove
        </button>
      </div>

      <div className="panel settings">
        <label>
          Race
          <select
            value={p.raceId ?? ''}
            onChange={(e) => dispatch({ type: 'setRace', playerId: p.id, raceId: e.target.value || null })}
          >
            <option value="">None</option>
            {c.races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Favorite stat (2x)
          <select
            value={p.favoriteStatId ?? ''}
            onChange={(e) => dispatch({ type: 'setFavorite', playerId: p.id, statId: e.target.value || null })}
          >
            <option value="">None</option>
            {c.stats
              .filter((s) => s.kind === 'primary')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={p.misc.on}
            onChange={(e) => dispatch({ type: 'setMisc', playerId: p.id, on: e.target.checked })}
          />
          Misc boost
          <input
            key={p.misc.mult}
            type="number"
            step="0.1"
            min={0.1}
            defaultValue={p.misc.mult}
            onBlur={(e) => dispatch({ type: 'setMisc', playerId: p.id, mult: Number(e.target.value) })}
          />
          x
        </label>
      </div>

      <div className="panel">
        <h4>Resources</h4>
        <Vitals p={p} onAp={(cur) => dispatch({ type: 'setPool', playerId: p.id, pool: 'ap', cur })} />
        <PoolCtl
          label="HP"
          pool={p.hp}
          onChange={(cur, max) => dispatch({ type: 'setPool', playerId: p.id, pool: 'hp', cur, max })}
        />
        <PoolCtl
          label="AP"
          pool={p.ap}
          onChange={(cur, max) => dispatch({ type: 'setPool', playerId: p.id, pool: 'ap', cur, max })}
        />
        <PoolCtl
          label="Mana"
          pool={p.mana}
          onChange={(cur, max) => dispatch({ type: 'setPool', playerId: p.id, pool: 'mana', cur, max })}
        />
        <div className="pool">
          <span>Spendable XP</span>
          <b className="gold">{p.spendableXp}</b>
          <select value={spendKey} onChange={(e) => setSpendKey(e.target.value)}>
            <option value="">Spend on…</option>
            {spendOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            step="any"
            value={spendAmt}
            onChange={(e) => setSpendAmt(Number(e.target.value) || 0)}
          />
          <button
            disabled={!spendKey || spendAmt <= 0 || spendAmt > p.spendableXp}
            onClick={() => dispatch({ type: 'spend', playerId: p.id, target: fromKey(spendKey), amount: spendAmt })}
          >
            Spend
          </button>
        </div>
      </div>

      <div className="panel">
        <h4>Stats</h4>
        {primary.map((s) => (
          <div key={s.id}>
            {statRow(s)}
            {c.stats.filter((x) => x.parentId === s.id).map((x) => statRow(x, true))}
          </div>
        ))}
        {loose.length > 0 && <h5>Secondary stats</h5>}
        {loose.map((s) => statRow(s))}
      </div>

      <div className="panel">
        <h4>Skills</h4>
        {unlocked.filter((a) => a.kind === 'skill').map(abilityRow)}
        {!unlocked.some((a) => a.kind === 'skill') && <p className="muted">No skills yet.</p>}
        <h4>Techniques</h4>
        {unlocked.filter((a) => a.kind === 'technique').map(abilityRow)}
        {!unlocked.some((a) => a.kind === 'technique') && <p className="muted">No techniques unlocked yet.</p>}

        {(lockedAuto.length > 0 || grantable.length > 0) && <h5>Locked</h5>}
        {lockedAuto.map((a) => (
          <div className="locked" key={a.id}>
            🔒 <b>{a.name}</b> <span className="muted">needs {reqText(a)}</span>
          </div>
        ))}
        {grantable.map((a) => (
          <div className="locked" key={a.id}>
            <span>
              <b>{a.name}</b> <span className="muted">({a.kind}, DM grants)</span>
            </span>
            <button onClick={() => dispatch({ type: 'learn', playerId: p.id, abilityId: a.id })}>Grant</button>
          </div>
        ))}
      </div>

      {picked.size > 0 && (
        <div className="action-bar">
          <span>{picked.size} selected</span>
          <button
            className="primary"
            onClick={() => {
              award(pickedTargets);
              setPicked(new Set());
            }}
          >
            Perform action (+1 XP each)
          </button>
          <button onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}
    </section>
  );
}
