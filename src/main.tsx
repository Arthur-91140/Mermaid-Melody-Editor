import '@xyflow/react/dist/style.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useEditing } from './canvas/graph/context';
import { useDocuments } from './store/documents';
import { useSelection } from './store/selection';
import './styles/app.css';

if (import.meta.env.DEV) {
  // Handy for debugging from the browser console.
  Object.assign(window, { mme: { documents: useDocuments, selection: useSelection, editing: useEditing } });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
