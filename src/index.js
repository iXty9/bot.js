import React from 'react';
import { createRoot } from 'react-dom/client';
import BotManager from './components/BotManager';
import './public/styles.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <BotManager />
    </React.StrictMode>
  );
} else {
  console.error('Root element not found');
}
