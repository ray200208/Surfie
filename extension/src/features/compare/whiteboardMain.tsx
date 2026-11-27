import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../sidepanel/index.css';
import { FullWhiteboardPage } from './FullWhiteboardPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FullWhiteboardPage />
  </StrictMode>
);
