// SECTION: Import Statements
// Import necessary modules from React and third-party libraries. React and Suspense are standard imports for building UI components.
// createRoot is used to manage the root DOM node of the React application.
// QueryClient and QueryClientProvider are from '@tanstack/react-query' to manage server state.
// Import custom components BotManager and ErrorBoundary from local files, and global styles.

import React, { Suspense, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BotManager from './components/BotManager.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './public/styles.css';

// SECTION: Initialize Query Client
// This initializes a new instance of QueryClient which will be used to handle asynchronous data-fetching operations and manage cache.

const queryClient = new QueryClient();

// SECTION: Access Key Extraction
// Extract access key from URL if present (for CLI integration)
const extractAccessKeyFromUrl = () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const accessKey = urlParams.get('access_key');
    
    if (accessKey) {
      // Store access key temporarily
      localStorage.setItem('access_key', accessKey);
      
      // Remove access key from URL without refreshing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      console.log('Access key extracted from URL and stored temporarily');
      
      // Set expiration for the access key (24 hours)
      const expirationTime = Date.now() + (24 * 60 * 60 * 1000);
      localStorage.setItem('access_key_expiration', expirationTime.toString());
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error extracting access key:', error);
    return false;
  }
};

// Extract access key on page load
extractAccessKeyFromUrl();

// Clean up expired access keys
const cleanupExpiredAccessKey = () => {
  const expirationTime = localStorage.getItem('access_key_expiration');
  if (expirationTime && parseInt(expirationTime, 10) < Date.now()) {
    localStorage.removeItem('access_key');
    localStorage.removeItem('access_key_expiration');
  }
};

// Run cleanup on load
cleanupExpiredAccessKey();

// SECTION: DOM Element Selection
// Selecting the root DOM element where the React application is going to be rendered using 'getElementById'.
// Ensures that the 'root' element is present in the DOM before proceeding.

const container = document.getElementById('root');

if (!container) {
  console.error('Root element not found. Application cannot start.');
  return;
}

// SECTION: Rendering the Application
// Creates a React root for managing updates to the container and renders the application components.
// Use StrictMode to help identify potential problems in the application.
// Wrap BotManager with ErrorBoundary to catch JavaScript errors and display user-friendly error messages.
// QueryClientProvider is used to provide the query client instance to the BotManager component for managing data fetching and caching.

const root = createRoot(container);
root.render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BotManager />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);

// SECURITY: Error Boundary
// ErrorBoundary is employed to catch and handle JavaScript errors in the component tree gracefully. It prevents the entire React component
// tree from crashing due to uncaught errors by providing a fallback UI.

// IMPROVEMENT SUGGESTION: Error Message Feedback
// Consider enhancing error logging by providing detailed information or alternatives, such as retrying the operation or a more descriptive message.

// Add event listener for unhandled errors
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
  // You could also send these errors to a logging service
});

// Add event listener for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // You could also send these errors to a logging service
});
