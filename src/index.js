import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
const BotManager = React.lazy(() => import('./components/BotManager'));

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <BotManager />
    </Suspense>
  </React.StrictMode>
);
