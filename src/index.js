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
        <Suspense fallback={
          <div style={{
            width: '100%',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))'
          }}>
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              background: 'hsl(var(--card))',
              borderRadius: 'var(--radius)',
              boxShadow: '0 8px 16px -4px rgb(0 0 0 / 0.2)'
            }}>
              Loading...
            </div>
          </div>
        }>
          <BotManager />
        </Suspense>
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error('Root element not found');
}
