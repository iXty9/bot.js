// Authentication utilities for the web UI

/**
 * Stores the authentication token in localStorage
 * @param {string} token - The Discord bot token
 */
export const storeToken = (token) => {
  if (!token) return;
  // Ensure we're storing a clean token
  localStorage.setItem('discord_bot_token', token.trim());
};

/**
 * Retrieves the authentication token from localStorage
 * @returns {string|null} The stored token or null if not found
 */
export const getToken = () => {
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
  const token = getToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};
