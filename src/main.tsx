import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { JoinApp } from './ui/JoinApp';
import './styles.css';

// Players open <address>/join; the DM opens the normal address.
const isJoin = location.pathname.replace(/\/+$/, '') === '/join';

createRoot(document.getElementById('root')!).render(<StrictMode>{isJoin ? <JoinApp /> : <App />}</StrictMode>);
