// SECTION: Import Statements
// Import necessary modules from React and third-party libraries. React and Suspense are standard imports for building UI components.
// createRoot is used to manage the root DOM node of the React application.
// QueryClient and QueryClientProvider are from '@tanstack/react-query' to manage server state.
// Import custom components BotManager and ErrorBoundary from local files, and global styles.

// Performance measurement
const measurePerformance = () => {
  // Record initial load time
  const loadTime = window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart;
  console.log(`Page load time: ${loadTime}ms`);
  
  // Monitor long tasks
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.warn(`Long task detected: ${entry.duration}ms`, entry);
        }
      });
      
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      console.error('PerformanceObserver for longtask not supported', e);
    }
  }
};

// Call performance measurement after page load
window.addEventListener('load', measurePerformance);

import React, { Suspense, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BotManager from './components/BotManager.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { setupMockApi } from './mockApi.js';
import './public/styles.css';

// Setup mock API for development
if (process.env.NODE_ENV === 'development') {
  setupMockApi();
}

// SECTION: Initialize Query Client
// This initializes a new instance of QueryClient which will be used to handle asynchronous data-fetching operations and manage cache.

const queryClient = new QueryClient();

// SECTION: Access Key Extraction
// Extract access key from URL if present (for CLI integration)
const extractAccessKeyFromUrl = () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const accessKey = urlParams.get('access_key');
    
    if (!accessKey) {
      return false;
    }
    
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
  } catch (error) {
    console.error('Error extracting access key:', error.message);
    // Log additional details in development
    if (process.env.NODE_ENV === 'development') {
      console.debug('Access key extraction error details:', error);
    }
    return false;
  }
};

// Extract access key on page load
extractAccessKeyFromUrl();

// Clean up expired access keys
const cleanupExpiredAccessKey = () => {
  try {
    const expirationTime = localStorage.getItem('access_key_expiration');
    if (!expirationTime) {
      return;
    }
    
    const expTime = parseInt(expirationTime, 10);
    if (isNaN(expTime)) {
      // Invalid expiration time, clean up anyway
      localStorage.removeItem('access_key');
      localStorage.removeItem('access_key_expiration');
      return;
    }
    
    if (expTime < Date.now()) {
      console.log('Removing expired access key');
      localStorage.removeItem('access_key');
      localStorage.removeItem('access_key_expiration');
    }
  } catch (error) {
    console.error('Error cleaning up expired access key:', error.message);
  }
};

// Run cleanup on load
cleanupExpiredAccessKey();

// Validate the stored access key
const validateStoredAccessKey = async () => {
  try {
    const accessKey = localStorage.getItem('access_key');
    if (!accessKey) {
      return false;
    }
    
    // You could add an API call here to validate the key with your server
    // For now, we'll just check if it's not expired
    const expirationTime = localStorage.getItem('access_key_expiration');
    if (!expirationTime || parseInt(expirationTime, 10) < Date.now()) {
      // Key is expired
      localStorage.removeItem('access_key');
      localStorage.removeItem('access_key_expiration');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating access key:', error.message);
    return false;
  }
};

// Validate on load
validateStoredAccessKey().then(isValid => {
  console.log('Access key validation result:', isValid);
});

// Check browser compatibility
const checkBrowserCompatibility = () => {
  const requiredFeatures = {
    localStorage: typeof localStorage !== 'undefined',
    fetch: typeof fetch !== 'undefined',
    promise: typeof Promise !== 'undefined',
    historyAPI: typeof window.history.pushState !== 'undefined'
  };
  
  const missingFeatures = Object.entries(requiredFeatures)
    .filter(([_, supported]) => !supported)
    .map(([feature]) => feature);
  
  if (missingFeatures.length > 0) {
    console.warn('Browser compatibility issues detected:', missingFeatures);
    return false;
  }
  
  return true;
};

// Check browser compatibility before proceeding
const isBrowserCompatible = checkBrowserCompatibility();
if (!isBrowserCompatible) {
  console.error('Your browser does not support all required features for this application.');
  // You could show a warning to the user here
}

// SECTION: DOM Element Selection and Rendering
// Ensure the DOM is fully loaded before attempting to render the React application
// This prevents "Root element not found" errors that can occur if the script runs before the DOM is ready

// Function to initialize the React application
const initializeApp = () => {
  // Selecting the root DOM element where the React application is going to be rendered
  const container = document.getElementById('app');

  if (!container) {
    console.error('App element not found. Application cannot start.');
    // Add a visible error message to the page
    document.body.innerHTML = `
      <div style="color: red; font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1>Application Error</h1>
        <p>Could not find the element with id="app" to mount the application.</p>
        <p>Please make sure the HTML contains an element with id="app".</p>
      </div>
    `;
    return;
  }

  console.log('Found app element, initializing React application');

  // Clear any existing content
  container.innerHTML = '';

  // Create the root and render the app
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

  // Log successful render
  console.log('React application rendered successfully');
};

// Wait for DOM to be fully loaded before initializing the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM already loaded, initialize immediately
  initializeApp();
}

// SECURITY: Error Boundary
// ErrorBoundary is employed to catch and handle JavaScript errors in the component tree gracefully. It prevents the entire React component
// tree from crashing due to uncaught errors by providing a fallback UI.

// IMPROVEMENT SUGGESTION: Error Message Feedback
// Consider enhancing error logging by providing detailed information or alternatives, such as retrying the operation or a more descriptive message.

// Handle application shutdown gracefully
const handleAppShutdown = () => {
  // Clean up resources, save state, etc.
  console.log('Application shutting down...');
  
  // Clear any sensitive data from localStorage
  localStorage.removeItem('access_key');
  localStorage.removeItem('access_key_expiration');
  
  // You could also save application state here
  
  console.log('Shutdown complete');
};

// Register shutdown handler for page unload
window.addEventListener('beforeunload', handleAppShutdown);

// Add event listener for unhandled errors with more detailed logging
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
  console.error('Error details:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    timestamp: new Date().toISOString()
  });
  
  // Prevent the error from being reported to the console again
  event.preventDefault();
  
  // You could send these errors to a logging service
  // logErrorToService(event.error);
});

// Add event listener for unhandled promise rejections with more detailed logging
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  console.error('Rejection details:', {
    reason: event.reason?.message || String(event.reason),
    stack: event.reason?.stack,
    timestamp: new Date().toISOString()
  });
  
  // Prevent the rejection from being reported to the console again
  event.preventDefault();
  
  // You could send these rejections to a logging service
  // logErrorToService(event.reason);
});

// Monitor network status
const monitorNetworkStatus = () => {
  const updateNetworkStatus = () => {
    const isOnline = navigator.onLine;
    console.log(`Network status: ${isOnline ? 'online' : 'offline'}`);
    
    // You could update the UI to show network status
    if (!isOnline) {
      // Show offline notification
      const notification = document.createElement('div');
      notification.id = 'offline-notification';
      notification.style = 'position: fixed; top: 0; left: 0; right: 0; background-color: #f44336; color: white; text-align: center; padding: 10px; z-index: 9999;';
      notification.textContent = 'You are currently offline. Some features may not work properly.';
      document.body.appendChild(notification);
    } else {
      // Remove offline notification if it exists
      const notification = document.getElementById('offline-notification');
      if (notification) {
        notification.remove();
      }
    }
  };
  
  // Update status initially
  updateNetworkStatus();
  
  // Listen for network status changes
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
};

// Start monitoring network status
monitorNetworkStatus();
