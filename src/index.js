import React from 'react';
import { createRoot } from 'react-dom/client';
import BotManager from './components/BotManager';
import './public/styles.css';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BotManager />
  </React.StrictMode>
);
