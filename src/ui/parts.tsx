import { useState, type ReactNode } from 'react';
import type { Rules, Target } from '../types';
import { levelInfo } from '../xp';

interface Ghost {
  from: number;
  to: number;
}

export function Bar({ xp, rules, full, ghost }: { xp: number; rules: Rules; full?: boolean; ghost?: Ghost | null }) {
  const pct = full ? 100 : levelInfo(xp, rules).progress * 100;
  return (
    <div className="bar">
      <div className="fill" style={{ width: `${pct}%` }} />
      {ghost && <div className="bar-ghost" style={{ left: `${ghost.from}%`, width: `${ghost.to - ghost.from}%` }} />}
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

/** Tiny markdown: headings, bullets, paragraphs. */
export function renderMarkdown(text: string): ReactNode {
  return text.split('\n').map((line, i) => {
    if (/^###\s/.test(line)) return <h5 key={i}>{line.slice(4)}</h5>;
    if (/^##\s/.test(line)) return <h4 key={i}>{line.slice(3)}</h4>;
    if (/^#\s/.test(line)) return <h3 key={i}>{line.slice(2)}</h3>;
    if (/^\s*[-*]\s/.test(line)) return <li key={i}>{line.replace(/^\s*[-*]\s/, '')}</li>;
    if (!line.trim()) return <br key={i} />;
    return <p key={i}>{line}</p>;
  });
}

/**
 * Copies text. The modern clipboard API only works on secure pages (https or localhost),
 * and a LAN address like http://192.168.0.17:3000 is not one, so fall back to the old way.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the fallback */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Icon-only copy button: shows a check when it worked. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const icon = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  return (
    <button
      className={`icon copy ${state}`}
      aria-label={label}
      title={
        state === 'ok' ? 'Copied!' : state === 'fail' ? 'Could not copy. Select the text and copy it by hand.' : label
      }
      onClick={async () => {
        setState((await copyText(text)) ? 'ok' : 'fail');
        setTimeout(() => setState('idle'), 1500);
      }}
    >
      {state === 'ok' ? (
        <svg {...icon}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg {...icon}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}
