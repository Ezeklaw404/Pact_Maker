import { useEffect, useState } from 'react';
import type { Permission, PlayerRequest } from '../protocol';
import type { PlayerView } from '../view';
import { renderMarkdown } from './parts';
import { PlayerSheet } from './PlayerSheet';

interface Props {
  view: PlayerView;
  permission: Permission;
  notice: string;
  onRequest: (req: PlayerRequest) => void;
  /** Only the real player screen has a Leave button; the host's preview does not. */
  onLeave?: () => void;
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
  const race = view.races.find((r) => r.id === me?.raceId)?.name;
  const fav = view.stats.find((s) => s.id === me?.favoriteStatId)?.name;

  return (
    <div className="player-screen">
      <header className="topbar">
        <h1>{view.campaignName}</h1>
        <div className="spacer" />
        <span className="muted">{permission === 'admin' ? 'Admin' : permission === 'edit' ? 'Can edit vitals' : 'View only'}</span>
        {onLeave && <button onClick={onLeave}>Leave</button>}
      </header>

      {view.combat && <div className="combat-banner">⚔ Combat: 3x XP</div>}

      <main>
        {me ? (
          <PlayerSheet
            view={view}
            p={me}
            permission={permission}
            onRequest={onRequest}
            onToast={setRolled}
            head={
              <>
                <h2 className="sheet-name">{me.name}</h2>
                <small className="muted">
                  {race ?? 'No race'}
                  {fav ? ` · ★ ${fav}` : ''}
                </small>
              </>
            }
          />
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
