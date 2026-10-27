/** Mounts the component-first ledger frontend with the shared token and layout styles. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';
import './styles/layout.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
