import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import BotManager from './components/BotManager.jsx';
import ErrorBoundary from './components/ErrorBoundary';
import './public/styles.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <Suspense fallback={<div>Loading...</div>}>
          <BotManager />
        </Suspense>
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error('Root element not found');
}
