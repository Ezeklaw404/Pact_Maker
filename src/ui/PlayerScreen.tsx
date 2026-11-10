import { useEffect, useState } from 'react';
import { rollDice } from '../dice';
import type { Permission, PlayerRequest } from '../protocol';
import { PoolCtl } from './PoolCtl';
import type { AbilityDef, Player, StatDef, Target } from '../types';
import type { PlayerView } from '../view';
import { Vitals } from './Vitals';
import { abilityCap, formatLevel, isMastered, isUnlocked, multiplier, statLevel, statXp, targetName } from '../xp';
import { Bar, renderMarkdown } from './parts';

interface Props {
  view: PlayerView;
  permission: Permission;
  notice: string;
  onRequest: (req: PlayerRequest) => void;
  onLeave?: () => void;
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
  onRoll: () => void;
}

function Row(r: RowProps) {
  return (
    <div className={`row${r.indent ? ' indent' : ''}`}>
      <div className="row-main">
        <div className="row-top">
          <span className="row-name">
            {r.name}
            {r.badge && <em className="badge">{r.badge}</em>}
            {r.mult > 1 && <em className="mult">×{r.mult}</em>}
          </span>
          {r.onEdit ? (
            <button className="level" onClick={r.onEdit} title="Click to edit manually">
              {formatLevel(r.xp, r.view.rules)}
            </button>
          ) : (
            <b className="level-num">{formatLevel(r.xp, r.view.rules)}</b>
          )}
        </div>
        <Bar xp={r.xp} rules={r.view.rules} full={r.full} />
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
      </div>
    </div>
  );
}

/** What a player sees: their own sheet in full, everyone else as name + race. */
export function PlayerScreen({ view, permission, notice, onRequest, onLeave }: Props) {
  const [rolled, setRolled] = useState('');
  useEffect(() => {
    if (!rolled) return;
    const t = setTimeout(() => setRolled(''), 8000);
    return () => clearTimeout(t);
  }, [rolled]);

  const me = view.me;
  const canAdd = permission === 'admin' && me !== null;
  const canEdit = permission !== 'view' && me !== null;
  const award = (targets: Target[]) => onRequest({ type: 'award', targets });
  const pool = (p: 'hp' | 'ap' | 'mana', cur?: number, max?: number) => onRequest({ type: 'pool', pool: p, cur, max });
  const edit = (t: Target, xp: number) => {
    const v = window.prompt(`Set ${targetName(view, t)} level (example: 4.05)`, formatLevel(xp, view.rules));
    const n = v === null ? NaN : parseFloat(v);
    if (Number.isFinite(n) && n >= 0) onRequest({ type: 'setLevel', target: t, level: n });
  };

  const roll = (p: Player, t: Target) => {
    const statId = t.type === 'stat' ? t.id : view.abilities.find((a) => a.id === t.id)?.statId;
    const bonus = statId ? statLevel(p, statId, view.rules) : 0;
    const r = rollDice(view.rules.dice, bonus);
    setRolled(
      r
        ? `${targetName(view, t)}: ${view.rules.dice} [${r.rolls.join(', ')}] + ${r.mod} = ${r.total}`
        : 'The dice setting is not valid.',
    );
  };

  const statRow = (p: Player, s: StatDef, indent = false) => {
    const t: Target = { type: 'stat', id: s.id };
    return (
      <Row
        key={s.id}
        name={s.name}
        xp={statXp(p, s.id)}
        view={view}
        mult={multiplier(view, p, t)}
        indent={indent}
        canAdd={canAdd}
        onAdd={() => award([t])}
        onEdit={canAdd ? () => edit(t, statXp(p, s.id)) : undefined}
        onRoll={() => roll(p, t)}
      />
    );
  };

  const abilityRow = (p: Player, a: AbilityDef) => {
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
        sub={[targetName(view, { type: 'stat', id: a.statId }), cost, cap ? `max level ${cap}` : '']
          .filter(Boolean)
          .join(' · ')}
        mult={multiplier(view, p, t)}
        canAdd={canAdd}
        onAdd={() => award([t])}
        onEdit={canAdd ? () => edit(t, xp) : undefined}
        onRoll={() => roll(p, t)}
      />
    );
  };

  const reqText = (a: AbilityDef) =>
    Object.entries(a.requires)
      .map(([id, n]) => `${targetName(view, { type: 'stat', id })} ${n}`)
      .join(', ') || 'no requirements';

  const sheet = (p: Player) => {
    const primary = view.stats.filter((s) => s.kind === 'primary');
    const loose = view.stats.filter((s) => s.kind === 'secondary' && !view.stats.some((x) => x.id === s.parentId));
    const unlocked = view.abilities.filter((a) => isUnlocked(view, p, a));
    const locked = view.abilities.filter((a) => a.unlock === 'auto' && !isUnlocked(view, p, a));
    const race = view.races.find((r) => r.id === p.raceId)?.name;
    const fav = view.stats.find((s) => s.id === p.favoriteStatId)?.name;
    const skills = unlocked.filter((a) => a.kind === 'skill');
    const techniques = unlocked.filter((a) => a.kind === 'technique');

    return (
      <>
        <div className="panel">
          <h2 className="sheet-name">{p.name}</h2>
          <small className="muted">
            {race ?? 'No race'}
            {fav ? ` · ★ ${fav}` : ''}
          </small>
          <Vitals p={p} onAp={canEdit ? (cur) => pool('ap', cur) : undefined} />
          {canEdit && (
            <>
              <PoolCtl
                label="HP"
                pool={p.hp}
                canMax={permission === 'admin'}
                onChange={(cur, max) => pool('hp', cur, max)}
              />
              <PoolCtl
                label="Mana"
                pool={p.mana}
                canMax={permission === 'admin'}
                onChange={(cur, max) => pool('mana', cur, max)}
              />
              <PoolCtl
                label="AP"
                pool={p.ap}
                canMax={permission === 'admin'}
                onChange={(cur, max) => pool('ap', cur, max)}
              />
            </>
          )}
          {p.spendableXp > 0 && <div className="pools gold">{p.spendableXp} XP to spend</div>}
        </div>

        <div className="panel">
          <h4>Stats</h4>
          {primary.map((s) => (
            <div key={s.id}>
              {statRow(p, s)}
              {view.stats.filter((x) => x.parentId === s.id).map((x) => statRow(p, x, true))}
            </div>
          ))}
          {loose.length > 0 && <h5>Secondary stats</h5>}
          {loose.map((s) => statRow(p, s))}
        </div>

        <div className="panel">
          <h4>Skills</h4>
          {skills.map((a) => abilityRow(p, a))}
          {!skills.length && <p className="muted">No skills yet.</p>}
          <h4>Techniques</h4>
          {techniques.map((a) => abilityRow(p, a))}
          {!techniques.length && <p className="muted">No techniques unlocked yet.</p>}
          {locked.length > 0 && <h5>Locked</h5>}
          {locked.map((a) => (
            <div className="locked" key={a.id}>
              <span>
                🔒 <b>{a.name}</b> <span className="muted">needs {reqText(a)}</span>
              </span>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="player-screen">
      <header className="topbar">
        <h1>{view.campaignName}</h1>
        <div className="spacer" />
        <span className="muted">
          {permission === 'admin' ? 'Admin' : permission === 'edit' ? 'Can edit vitals' : 'View only'}
        </span>
        {onLeave && <button onClick={onLeave}>Leave</button>}
      </header>

      {view.combat && <div className="combat-banner">⚔ Combat: 3x XP</div>}

      <main>
        {me ? (
          sheet(me)
        ) : (
          <div className="panel">
            <h4>You are watching</h4>
            <p className="muted">You are not assigned to a character yet. Ask the host to assign you one.</p>
          </div>
        )}

        <div className="panel">
          <h4>Party</h4>
          {view.others.length === 0 && <p className="muted">Nobody else yet.</p>}
          {view.others.map((o) => (
            <div className="list-row" key={o.id}>
              <span>{o.name}</span>
              <span className="muted">{view.races.find((r) => r.id === o.raceId)?.name ?? 'No race'}</span>
            </div>
          ))}
        </div>

        <details className="panel">
          <summary>House rules</summary>
          <div className="rules-view">{renderMarkdown(view.rulesText)}</div>
        </details>
      </main>

      {(notice || rolled) && (
        <div className="toast" onClick={() => setRolled('')}>
          {notice || rolled}
        </div>
      )}
    </div>
  );
}
