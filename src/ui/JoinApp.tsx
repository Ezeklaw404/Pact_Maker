import { useState } from 'react';
import { usePlayer } from '../usePlayer';
import { PlayerScreen } from './PlayerScreen';

const read = (k: string) => {
  try {
    return localStorage.getItem(`pm:join:${k}`) ?? '';
  } catch {
    return '';
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(`pm:join:${k}`, v);
  } catch {
    /* optional convenience */
  }
};

/** The page players see at <address>/join. */
export function JoinApp() {
  const p = usePlayer();
  const [name, setName] = useState(() => read('name'));
  const [room, setRoom] = useState(() =>
    (new URLSearchParams(location.search).get('room') ?? read('room')).toUpperCase(),
  );

  if (p.status === 'in' && p.view) {
    return (
      <PlayerScreen view={p.view} permission={p.permission} notice={p.notice} onAward={p.award} onLeave={p.leave} />
    );
  }

  const connecting = p.status !== 'idle';
  const canJoin = !connecting && name.trim() !== '' && room.trim() !== '';

  return (
    <form
      className="join"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canJoin) return;
        write('name', name.trim());
        write('room', room.trim());
        p.join(room, name);
      }}
    >
      <h1>Pact Maker</h1>
      <p className="hint">Enter your character's name and the room code from your DM.</p>
      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="off" />
      </label>
      <label>
        Room code
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value.toUpperCase())}
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
        />
      </label>
      <button className="primary" type="submit" disabled={!canJoin}>
        {connecting ? 'Joining…' : 'Join'}
      </button>
      {p.error && (
        <p className="err">
          {p.error === 'Connection lost'
            ? 'Could not reach the host. Check the address, and that the host has started hosting.'
            : p.error}
        </p>
      )}
    </form>
  );
}
