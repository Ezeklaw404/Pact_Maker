import { useEffect, useState } from 'react';
import { useStore } from './store';
import { ActionModal } from './ui/ActionModal';
import { FocusView } from './ui/FocusView';
import { GrantModal } from './ui/GrantModal';
import { Menu } from './ui/Menu';
import { PlayerCard } from './ui/PlayerCard';
import { useHost } from './useHost';
import { RestModal } from './ui/RestModal';

type Modal = 'action' | 'grant' | 'rest' | null;

export function App() {
  const store = useStore();
  const { campaign: c, dispatch, undo, redo } = store;
  const host = useHost(c, dispatch);

  const [focusId, setFocusId] = useState<string | null>(null);
  const [selected, setSelected] = useState(new Set<string>());
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  // Ctrl+Z / Ctrl+Y (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  if (!c) return <div className="loading">Loading…</div>;

  const focused = focusId ? c.players.find((p) => p.id === focusId) : undefined;
  const livePlayers = c.players.map((p) => p.id);
  const picked = [...selected].filter((id) => livePlayers.includes(id));
  const modalPlayers = focused ? [focused.id] : picked.length ? picked : livePlayers;

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className={`app${c.combat ? ' in-combat' : ''}`}>
      <header className="topbar">
        <button className="icon" onClick={() => setMenu(true)} aria-label="Menu">
          ☰
        </button>
        <h1>{c.name}</h1>
        <div className="spacer" />
        {host.status === 'on' && (
          <button className="live" onClick={() => setMenu(true)} title="Hosting: open the Host tab in the menu">
            ● {host.room} · {host.sessions.length}
          </button>
        )}
        <button className={`toggle${c.combat ? ' on' : ''}`} onClick={() => dispatch({ type: 'toggleCombat' })}>
          ⚔ Combat {c.combat ? 'ON · 3x' : 'off'}
        </button>
        <button className="primary" onClick={() => setModal('action')}>
          Action
        </button>
        <button onClick={() => setModal('grant')}>Grant XP</button>
        <button onClick={() => setModal('rest')}>Rest</button>
        <button className="icon" onClick={undo} disabled={!store.canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
          ↶
        </button>
        <button className="icon" onClick={redo} disabled={!store.canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
          ↷
        </button>
      </header>

      <main>
        {focused ? (
          <FocusView
            key={focused.id}
            c={c}
            p={focused}
            dispatch={dispatch}
            onBack={() => setFocusId(null)}
            onToast={setToast}
          />
        ) : (
          <>
            {c.players.length === 0 && <p className="empty">No players yet. Add some in the menu → Players.</p>}
            <div className="grid">
              {c.players.map((p) => (
                <PlayerCard
                  key={p.id}
                  c={c}
                  p={p}
                  selected={selected.has(p.id)}
                  onSelect={() => toggleSelect(p.id)}
                  onOpen={() => setFocusId(p.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {toast && (
        <div className="toast" onClick={() => setToast('')}>
          {toast}
        </div>
      )}

      {menu && (
        <Menu
          c={c}
          index={store.index}
          dispatch={dispatch}
          onOpen={(id) => {
            store.open(id);
            setFocusId(null);
            setSelected(new Set());
            setMenu(false);
          }}
          onCreate={(name) => {
            store.create(name);
            setFocusId(null);
            setSelected(new Set());
            setMenu(false);
          }}
          onRemove={store.remove}
          onImport={(text) => {
            store.importText(text);
            setFocusId(null);
            setSelected(new Set());
            setMenu(false);
          }}
          onClose={() => setMenu(false)}
          host={host}
        />
      )}
      {modal === 'action' && (
        <ActionModal c={c} initialPlayers={modalPlayers} dispatch={dispatch} onClose={() => setModal(null)} />
      )}
      {modal === 'grant' && (
        <GrantModal c={c} initialPlayers={modalPlayers} dispatch={dispatch} onClose={() => setModal(null)} />
      )}
      {modal === 'rest' && (
        <RestModal c={c} initialPlayers={modalPlayers} dispatch={dispatch} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
