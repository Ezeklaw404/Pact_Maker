import type { ReactNode } from 'react';
import type { Rules, Target } from '../types';
import { levelInfo } from '../xp';

export function Bar({ xp, rules, full }: { xp: number; rules: Rules; full?: boolean }) {
  const pct = full ? 100 : levelInfo(xp, rules).progress * 100;
  return (
    <div className="bar">
      <div className="fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const keyOf = (t: Target) => `${t.type}:${t.id}`;
export const fromKey = (k: string): Target => {
  const [type, ...rest] = k.split(':');
  return { type: type as Target['type'], id: rest.join(':') };
};

export function download(filename: string, text: string, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
