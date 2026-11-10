import { useState } from 'react';
import { parseDice } from '../dice';
import { exportCampaign } from '../portable';
import type { Action } from '../reducer';
import type { CampaignSummary } from '../storage';
import type { AbilityDef, Campaign, RaceDef, StatDef, StatKind } from '../types';
import { CopyButton, download, Modal, renderMarkdown } from './parts';
import type { Permission } from '../protocol';
import type { HostApi } from '../useHost';
import { viewFor } from '../view';
import { PlayerScreen } from './PlayerScreen';

interface Props {
  c: Campaign;
  index: CampaignSummary[];
  host: HostApi;
  dispatch: (a: Action) => void;
  onOpen: (id: string) => void;
  onCreate: (name: string) => void;
  onRemove: (id: string) => void;
  onImport: (text: string) => void;
  onClose: () => void;
}

type Tab = 'campaigns' | 'players' | 'library' | 'rules' | 'log' | 'host';
const TABS: [Tab, string][] = [
  ['campaigns', 'Campaigns'],
  ['players', 'Players'],
  ['library', 'Library'],
  ['rules', 'Rules'],
  ['log', 'Log'],
  ['host', 'Host'],
];

function parseRequires(text: string, c: Campaign): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of text.split(',')) {
    const [rawName, rawNum] = part.split(':').map((x) => x.trim());
    const n = Number(rawNum);
    if (!rawName || !Number.isFinite(n)) continue;
    const stat = c.stats.find((s) => s.id === rawName.toLowerCase() || s.name.toLowerCase() === rawName.toLowerCase());
    if (stat) out[stat.id] = n;
  }
  return out;
}

function CampaignsTab({ c, index, dispatch, onOpen, onCreate, onRemove, onImport }: Props) {
  const [newName, setNewName] = useState('');
  const [name, setName] = useState(c.name);
  const [dice, setDice] = useState(c.rules.dice);
  const [err, setErr] = useState('');

  return (
    <div>
      <h4>Current campaign</h4>
      <div className="form-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => dispatch({ type: 'renameCampaign', name })}
        />
        <button onClick={() => download(`${c.name.replace(/[^a-z0-9]+/gi, '-')}.pactmaker.json`, exportCampaign(c))}>
          Export
        </button>
      </div>
      <label className="stack">
        Standard roll
        <input
          value={dice}
          onChange={(e) => setDice(e.target.value)}
          onBlur={() => {
            if (parseDice(dice)) {
              setErr('');
              dispatch({ type: 'setDice', dice: dice.trim() });
            } else setErr('Use a format like 3d6 or 2d10+1');
          }}
        />
        {err && <small className="err">{err}</small>}
      </label>

      <h4>All campaigns</h4>
      {index.map((i) => (
        <div className="list-row" key={i.id}>
          <span>
            {i.name} {i.id === c.id && <em className="badge">open</em>}
          </span>
          <span>
            {i.id !== c.id && <button onClick={() => onOpen(i.id)}>Open</button>}
            <button className="danger" onClick={() => window.confirm(`Delete "${i.name}" forever?`) && onRemove(i.id)}>
              Delete
            </button>
          </span>
        </div>
      ))}

      <h4>New or import</h4>
      <div className="form-row">
        <input placeholder="Campaign name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button
          onClick={() => {
            onCreate(newName);
            setNewName('');
          }}
        >
          Create
        </button>
      </div>
      <label className="stack">
        Import a campaign file
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              onImport(await f.text());
              setErr('');
            } catch (ex) {
              setErr(ex instanceof Error ? ex.message : 'Could not import that file.');
            }
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

function PlayersTab({ c, dispatch }: Props) {
  const [name, setName] = useState('');
  return (
    <div>
      {c.players.map((p) => (
        <div className="list-row" key={p.id}>
          <span>
            {p.name} {p.gmOnly && <em className="badge">GM only</em>}
          </span>
          <button
            className="danger"
            onClick={() => window.confirm(`Remove ${p.name}?`) && dispatch({ type: 'removePlayer', playerId: p.id })}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="form-row">
        <input placeholder="New player name" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          onClick={() => {
            dispatch({ type: 'addPlayer', name });
            setName('');
          }}
        >
          Add player
        </button>
        <button
          title="Hidden from players"
          onClick={() => {
            dispatch({ type: 'addPlayer', name, gmOnly: true });
            setName('');
          }}
        >
          Add monster
        </button>
      </div>
      <p className="muted">Monsters are GM-only: players never see them.</p>
    </div>
  );
}

type Dispatch = (a: Action) => void;

function StatEdit({
  c,
  stat,
  dispatch,
  onDone,
}: {
  c: Campaign;
  stat: StatDef;
  dispatch: Dispatch;
  onDone: () => void;
}) {
  const [name, setName] = useState(stat.name);
  const [parentId, setParentId] = useState(stat.parentId ?? '');
  const blockers = c.abilities.filter((a) => a.statId === stat.id);
  return (
    <div className="edit-box">
      <input value={name} onChange={(e) => setName(e.target.value)} />
      {stat.kind === 'secondary' && (
        <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
          <option value="">No parent stat</option>
          {c.stats
            .filter((s) => s.kind === 'primary')
            .map((s) => (
              <option key={s.id} value={s.id}>
                under {s.name}
              </option>
            ))}
        </select>
      )}
      {blockers.length > 0 && (
        <small className="muted">Can't delete: used by {blockers.map((a) => a.name).join(', ')}</small>
      )}
      <div className="form-row">
        <button
          className="primary"
          onClick={() => {
            dispatch({
              type: 'editStat',
              id: stat.id,
              name,
              parentId: stat.kind === 'secondary' ? parentId || null : undefined,
            });
            onDone();
          }}
        >
          Save
        </button>
        <button onClick={onDone}>Cancel</button>
        <span className="spacer" />
        <button
          className="danger"
          disabled={blockers.length > 0}
          onClick={() => {
            if (window.confirm(`Delete ${stat.name}? Players lose their XP in it.`)) {
              dispatch({ type: 'deleteStat', id: stat.id });
              onDone();
            }
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function RaceEdit({ race, dispatch, onDone }: { race: RaceDef; dispatch: Dispatch; onDone: () => void }) {
  const [name, setName] = useState(race.name);
  const [notes, setNotes] = useState(race.notes);
  return (
    <div className="edit-box">
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="form-row">
        <button
          className="primary"
          onClick={() => {
            dispatch({ type: 'editRace', id: race.id, name, notes });
            onDone();
          }}
        >
          Save
        </button>
        <button onClick={onDone}>Cancel</button>
        <span className="spacer" />
        <button
          className="danger"
          onClick={() => {
            if (window.confirm(`Delete ${race.name}? Players with it go back to no race.`)) {
              dispatch({ type: 'deleteRace', id: race.id });
              onDone();
            }
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AbilityEdit({
  c,
  ability,
  dispatch,
  onDone,
}: {
  c: Campaign;
  ability: AbilityDef;
  dispatch: Dispatch;
  onDone: () => void;
}) {
  const [f, setF] = useState({
    name: ability.name,
    kind: ability.kind,
    statId: ability.statId,
    unlock: ability.unlock,
    requires: Object.entries(ability.requires)
      .map(([id, n]) => `${c.stats.find((s) => s.id === id)?.name ?? id}:${n}`)
      .join(', '),
    ap: ability.apCost,
    mana: ability.manaCost,
    notes: ability.notes,
  });
  const save = () => {
    dispatch({
      type: 'editAbility',
      id: ability.id,
      patch: {
        name: f.name,
        kind: f.kind,
        statId: f.statId,
        unlock: f.unlock,
        requires: parseRequires(f.requires, c),
        apCost: f.ap,
        manaCost: f.mana,
        notes: f.notes,
      },
    });
    onDone();
  };
  return (
    <div className="edit-box">
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as AbilityDef['kind'] })}>
        <option value="technique">Technique</option>
        <option value="skill">Skill</option>
      </select>
      <select value={f.statId} onChange={(e) => setF({ ...f, statId: e.target.value })}>
        {c.stats.map((s) => (
          <option key={s.id} value={s.id}>
            Linked stat: {s.name}
          </option>
        ))}
      </select>
      <select value={f.unlock} onChange={(e) => setF({ ...f, unlock: e.target.value as AbilityDef['unlock'] })}>
        <option value="auto">Unlocks automatically at stat levels</option>
        <option value="dm">DM grants it</option>
      </select>
      <input
        placeholder="e.g. Force:4, Fire:1"
        value={f.requires}
        onChange={(e) => setF({ ...f, requires: e.target.value })}
      />
      <label>
        AP cost
        <input type="number" min={0} value={f.ap} onChange={(e) => setF({ ...f, ap: Number(e.target.value) || 0 })} />
      </label>
      <label>
        Mana cost
        <input
          type="number"
          min={0}
          value={f.mana}
          onChange={(e) => setF({ ...f, mana: Number(e.target.value) || 0 })}
        />
      </label>
      <textarea placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <div className="form-row">
        <button className="primary" onClick={save}>
          Save
        </button>
        <button onClick={onDone}>Cancel</button>
        <span className="spacer" />
        <button
          className="danger"
          onClick={() => {
            if (window.confirm(`Delete ${ability.name}? Players lose it and its progress.`)) {
              dispatch({ type: 'deleteAbility', id: ability.id });
              onDone();
            }
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function LibraryTab({ c, dispatch }: Props) {
  const [statName, setStatName] = useState('');
  const [statKind, setStatKind] = useState<StatKind>('secondary');
  const [parentId, setParentId] = useState('');
  const [raceName, setRaceName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const done = () => setEditing(null);
  const toggle = (k: string) => setEditing(editing === k ? null : k);
  const statSel = c.stats.find((s) => editing === `stat:${s.id}`);
  const raceSel = c.races.find((r) => editing === `race:${r.id}`);
  const abSel = c.abilities.find((a) => editing === `ability:${a.id}`);
  const [ab, setAb] = useState({
    name: '',
    kind: 'technique' as AbilityDef['kind'],
    statId: c.stats[0]?.id ?? '',
    unlock: 'auto' as AbilityDef['unlock'],
    ap: 0,
    mana: 0,
    requires: '',
    notes: '',
  });

  return (
    <div>
      <h4>Add a stat</h4>
      <div className="form-row wrap">
        <input placeholder="Name" value={statName} onChange={(e) => setStatName(e.target.value)} />
        <select value={statKind} onChange={(e) => setStatKind(e.target.value as StatKind)}>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
        </select>
        {statKind === 'secondary' && (
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">No parent stat</option>
            {c.stats
              .filter((s) => s.kind === 'primary')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  under {s.name}
                </option>
              ))}
          </select>
        )}
        <button
          onClick={() => {
            dispatch({ type: 'addStat', name: statName, kind: statKind, parentId: parentId || undefined });
            setStatName('');
          }}
        >
          Add
        </button>
      </div>

      <h4>Add a race</h4>
      <div className="form-row">
        <input placeholder="Name" value={raceName} onChange={(e) => setRaceName(e.target.value)} />
        <button
          onClick={() => {
            dispatch({ type: 'addRace', name: raceName });
            setRaceName('');
          }}
        >
          Add
        </button>
      </div>

      <h4>Add a skill or technique</h4>
      <div className="form-grid">
        <input placeholder="Name" value={ab.name} onChange={(e) => setAb({ ...ab, name: e.target.value })} />
        <select value={ab.kind} onChange={(e) => setAb({ ...ab, kind: e.target.value as AbilityDef['kind'] })}>
          <option value="technique">Technique</option>
          <option value="skill">Skill</option>
        </select>
        <select value={ab.statId} onChange={(e) => setAb({ ...ab, statId: e.target.value })}>
          {c.stats.map((s) => (
            <option key={s.id} value={s.id}>
              Primary stat: {s.name}
            </option>
          ))}
        </select>
        <select value={ab.unlock} onChange={(e) => setAb({ ...ab, unlock: e.target.value as AbilityDef['unlock'] })}>
          <option value="auto">Unlocks at stat levels</option>
          <option value="dm">DM granted</option>
        </select>
        <input
          placeholder="Needs, e.g. Force:4, Area:2, Fire:1"
          value={ab.requires}
          onChange={(e) => setAb({ ...ab, requires: e.target.value })}
        />
        <label>
          AP cost
          <input
            type="number"
            min={0}
            value={ab.ap}
            onChange={(e) => setAb({ ...ab, ap: Number(e.target.value) || 0 })}
          />
        </label>
        <label>
          Mana cost
          <input
            type="number"
            min={0}
            value={ab.mana}
            onChange={(e) => setAb({ ...ab, mana: Number(e.target.value) || 0 })}
          />
        </label>
        <button
          onClick={() => {
            dispatch({
              type: 'addAbility',
              def: {
                name: ab.name,
                kind: ab.kind,
                statId: ab.statId,
                unlock: ab.unlock,
                requires: parseRequires(ab.requires, c),
                apCost: ab.ap,
                manaCost: ab.mana,
                notes: ab.notes,
              },
            });
            setAb({ ...ab, name: '', requires: '' });
          }}
        >
          Add
        </button>
      </div>

      <h4>Edit existing</h4>

      <h5>Stats</h5>
      <div className="link-list">
        {c.stats.map((s) => (
          <button
            key={s.id}
            className={`link${s.kind === 'secondary' ? ' secondary' : ''}${editing === `stat:${s.id}` ? ' active' : ''}`}
            title={s.kind}
            onClick={() => toggle(`stat:${s.id}`)}
          >
            {s.name}
          </button>
        ))}
      </div>
      {statSel && <StatEdit key={statSel.id} c={c} stat={statSel} dispatch={dispatch} onDone={done} />}

      <h5>Races</h5>
      <div className="link-list">
        {c.races.map((r) => (
          <button
            key={r.id}
            className={`link${editing === `race:${r.id}` ? ' active' : ''}`}
            onClick={() => toggle(`race:${r.id}`)}
          >
            {r.name}
          </button>
        ))}
      </div>
      {raceSel && <RaceEdit key={raceSel.id} race={raceSel} dispatch={dispatch} onDone={done} />}

      <h5>Skills and techniques</h5>
      <div className="link-list">
        {c.abilities.map((a) => (
          <button
            key={a.id}
            className={`link${editing === `ability:${a.id}` ? ' active' : ''}`}
            title={a.kind}
            onClick={() => toggle(`ability:${a.id}`)}
          >
            {a.name}
          </button>
        ))}
      </div>
      {abSel && <AbilityEdit key={abSel.id} c={c} ability={abSel} dispatch={dispatch} onDone={done} />}
    </div>
  );
}

function RulesTab({ c, dispatch }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.rulesText);
  return (
    <div>
      <div className="form-row">
        <button
          onClick={() => (editing ? (dispatch({ type: 'setRulesText', text }), setEditing(false)) : setEditing(true))}
        >
          {editing ? 'Save' : 'Edit'}
        </button>
        <label className="file-btn">
          Import .md / .txt
          <input
            type="file"
            accept=".md,.txt,text/plain,text/markdown"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const t = await f.text();
              setText(t);
              dispatch({ type: 'setRulesText', text: t });
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {editing ? (
        <textarea className="rules-edit" value={text} onChange={(e) => setText(e.target.value)} />
      ) : (
        <div className="rules-view">{renderMarkdown(c.rulesText)}</div>
      )}
    </div>
  );
}

function LogTab({ c }: Props) {
  const rows = [...c.log].reverse().slice(0, 80);
  return (
    <div>
      {rows.length === 0 && <p className="muted">Nothing yet.</p>}
      {rows.map((l) => (
        <div className="log-row" key={l.id}>
          <small className="muted">
            {new Date(l.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </small>
          <span>{l.text}</span>
        </div>
      ))}
    </div>
  );
}

function HostTab({ c, host }: Props) {
  const players = c.players.filter((p) => !p.gmOnly);
  const [preview, setPreview] = useState<string | null>(null);
  const previewSession = host.sessions.find((s) => s.peerId === preview);
  const joinLink = `${location.origin}/join?room=${host.room}`;

  if (host.status !== 'on') {
    return (
      <div>
        <p className="hint">
          Start hosting to let players join from their own devices. They open the same address you use to reach this app
          (your network IP, Radmin IP, or tunnel link, not "localhost") and type the room code.
        </p>
        <button className="primary" disabled={host.status === 'starting'} onClick={host.start}>
          {host.status === 'starting' ? 'Starting…' : 'Start hosting'}
        </button>
        {host.error && (
          <p className="err">
            {host.error === 'Connection lost'
              ? 'Could not reach the host server. Is "npm run host" running?'
              : host.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="hint">
        Players open this link (swap "localhost" for your network IP, Radmin IP, or tunnel link), or go to /join and
        type the code.
      </p>
      <div className="room">
        <b className="room-code">{host.room}</b>
        <CopyButton text={host.room} label="Copy room code" />
      </div>
      <div className="room">
        <code className="join-link">{joinLink}</code>
        <CopyButton text={joinLink} label="Copy join link" />
      </div>

      <h4>Connected ({host.sessions.length})</h4>
      {host.sessions.length === 0 && <p className="muted">Nobody yet.</p>}
      {host.sessions.map((s) => (
        <div className="edit-box" key={s.peerId}>
          <b>{s.name}</b>
          <select value={s.playerId ?? ''} onChange={(e) => host.assign(s.peerId, e.target.value || null)}>
            <option value="">No character (spectator)</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                Plays {p.name}
              </option>
            ))}
          </select>
          <select value={s.permission} onChange={(e) => host.setPermission(s.peerId, e.target.value as Permission)}>
            <option value="view">View only</option>
            <option value="edit">Edit own HP, mana, AP</option>
            <option value="admin">Admin (also XP and maximums)</option>
          </select>
          <div className="form-row">
            <button onClick={() => setPreview(s.peerId)}>View as player</button>
            <button className="danger" onClick={() => host.kick(s.peerId)}>
              Kick
            </button>
          </div>
        </div>
      ))}

      {previewSession && (
        <Modal title={`${previewSession.name}'s view`} onClose={() => setPreview(null)}>
          <PlayerScreen
            view={viewFor(c, previewSession.playerId)}
            permission={previewSession.permission}
            notice=""
            onRequest={() => {}}
          />
        </Modal>
      )}

      <div className="form-row">
        <button className="danger" onClick={host.stop}>
          Stop hosting
        </button>
      </div>
    </div>
  );
}

export function Menu(props: Props) {
  const [tab, setTab] = useState<Tab>('campaigns');
  return (
    <div className="overlay left" onClick={props.onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Pact Maker</h2>
          <button className="icon" onClick={props.onClose} aria-label="Close menu">
            ✕
          </button>
        </div>
        <nav className="tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="drawer-body">
          {tab === 'campaigns' && <CampaignsTab {...props} />}
          {tab === 'players' && <PlayersTab {...props} />}
          {tab === 'library' && <LibraryTab {...props} />}
          {tab === 'rules' && <RulesTab {...props} />}
          {tab === 'log' && <LogTab {...props} />}
          {tab === 'host' && <HostTab {...props} />}
        </div>
      </aside>
    </div>
  );
}
