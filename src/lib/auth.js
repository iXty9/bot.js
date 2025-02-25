// Authentication utilities for the web UI

/**
 * Stores the authentication token in localStorage
 * @param {string} token - The Discord bot token
 */
export const storeToken = (token) => {
  if (!token) return;
  // Ensure we're storing a clean token with no whitespace or invisible characters
  // Normalize to lowercase to ensure consistent comparison
  const cleanToken = token.trim().replace(/\s+/g, '').toLowerCase();
  localStorage.setItem('discord_bot_token', cleanToken);
  console.log('Token stored:', cleanToken.substring(0, 5) + '...', 'last 5 chars:', cleanToken.slice(-5));
};

/**
 * Retrieves the authentication token from localStorage
 * @returns {string|null} The stored token or null if not found
 */
export const getToken = () => {
  const token = localStorage.getItem('discord_bot_token');
  // Ensure token is clean when retrieved
  // Normalize to lowercase to ensure consistent comparison
  return token ? token.trim().replace(/\s+/g, '').toLowerCase() : null;
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
  // Try to use the original token first (not normalized)
  let token = localStorage.getItem('discord_bot_token_original');
  
  // Fall back to normalized token if original is not available
  if (!token) {
    token = getToken();
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
