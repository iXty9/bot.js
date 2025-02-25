// SECTION: Import Statements
// Import necessary modules from React and third-party libraries. React and Suspense are standard imports for building UI components.
// createRoot is used to manage the root DOM node of the React application.
// QueryClient and QueryClientProvider are from '@tanstack/react-query' to manage server state.
// Import custom components BotManager and ErrorBoundary from local files, and global styles.

import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BotManager from './components/BotManager.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { storeToken } from './lib/auth.js';
import './public/styles.css';

// SECTION: Initialize Query Client
// This initializes a new instance of QueryClient which will be used to handle asynchronous data-fetching operations and manage cache.

const queryClient = new QueryClient();

// SECTION: Token Extraction
// Extract token from URL if present (for CLI integration)
const extractTokenFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (token) {
    // Store token and remove it from URL for security
    storeToken(token.trim());
    
    // Remove token from URL without refreshing
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
    
    console.log('Token extracted from URL and stored');
    return true;
  }
  return false;
};

// Extract token on page load
extractTokenFromUrl();

// SECTION: DOM Element Selection
// Selecting the root DOM element where the React application is going to be rendered using 'getElementById'.
// Ensures that the 'root' element is present in the DOM before proceeding.

const container = document.getElementById('root');

// VALIDATION: Root Element Check
// Ensures that a container element with the id 'root' exists before proceeding to render the application.
// Logs an error message if the element is not found.

if (container) {
  // SECTION: Rendering the Application
  // Creates a React root for managing updates to the container and renders the application components.
  // Use the React.StrictMode to help identify potential problems in the application.
  // Wrap BotManager with ErrorBoundary to catch JavaScript errors and display user-friendly error messages.
  // QueryClientProvider is used to provide the query client instance to the BotManager component for managing data fetching and caching.

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BotManager />
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  // UI FEEDBACK: Error Log
  // Logs an error to the console if the root element is not found, indicating that the application might not render correctly.

  console.error('Root element not found');
}

// SECURITY: Error Boundary
// ErrorBoundary is employed to catch and handle JavaScript errors in the component tree gracefully. It prevents the entire React component
// tree from crashing due to uncaught errors by providing a fallback UI.

// IMPROVEMENT SUGGESTION: Error Message Feedback
// Consider enhancing error logging by providing detailed information or alternatives, such as retrying the operation or a more descriptive message.
