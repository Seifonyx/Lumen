import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './styles.css';
import App from './App';
import './design.css';
import './feature-surfaces.css';
import './workspace.css';
import './claude-layout.css';
import { initViewport } from './lib/viewport';

// iPhone: keep the app on the visible area while the keyboard is open.
initViewport();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
