// Authentication utilities for the web UI

/**
 * Stores the authentication token in localStorage
 * @param {string} token - The Discord bot token
 */
export const storeToken = (token) => {
  if (!token) return;
  // Store token exactly as is without any modification
  localStorage.setItem('discord_bot_token', token);
  console.log('Token stored:', token.substring(0, 5) + '...', 'last 5 chars:', token.slice(-5));
};

/**
 * Retrieves the authentication token from localStorage
 * @returns {string|null} The stored token or null if not found
 */
export const getToken = () => {
  // Return token exactly as stored without any modification
  return localStorage.getItem('discord_bot_token');
};

/**
 * Clears the stored authentication token
 */
export const clearToken = () => {
  localStorage.removeItem('discord_bot_token');
};

/**
 * Checks if a token is stored and valid
 * @returns {boolean} True if a token exists
 */
export const hasToken = () => {
  const token = getToken();
  return !!token && token.length > 10;
};

/**
 * Creates an Authorization header with the stored token
 * @returns {Object} Headers object with Authorization
 */
export const getAuthHeaders = () => {
  // Use the original token exactly as it was received
  let token = localStorage.getItem('discord_bot_token_original');
  
  // Fall back to regular token if original is not available
  if (!token) {
    token = localStorage.getItem('discord_bot_token');
  }
  
  // Only include Authorization header if token exists
  if (!token) {
    return { 'Content-Type': 'application/json' };
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};
