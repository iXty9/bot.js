// Authentication utilities for the web UI

/**
 * Stores the session token in localStorage
 * @param {string} token - The session token
 * @param {number} expiresAt - Expiration timestamp
 */
export const storeToken = (token, expiresAt) => {
  if (!token) return;
  localStorage.setItem('session_token', token);
  if (expiresAt) {
    localStorage.setItem('session_expires', expiresAt.toString());
  }
  console.log('Session token stored, expires:', new Date(expiresAt).toLocaleString());
};

/**
 * Retrieves the session token from localStorage
 * @returns {string|null} The stored token or null if not found
 */
export const getToken = () => {
  return localStorage.getItem('session_token');
};

/**
 * Clears the stored session token
 */
export const clearToken = () => {
  localStorage.removeItem('session_token');
  localStorage.removeItem('session_expires');
};

/**
 * Checks if a token is stored and not expired
 * @returns {boolean} True if a valid token exists
 */
export const hasToken = () => {
  const token = getToken();
  if (!token) return false;
  
  const expiresAt = localStorage.getItem('session_expires');
  if (expiresAt && parseInt(expiresAt) < Date.now()) {
    clearToken(); // Clear expired token
    return false;
  }
  
  return true;
};

/**
 * Creates an Authorization header with the stored token
 * @returns {Object} Headers object with Authorization
 */
export const getAuthHeaders = () => {
  const token = getToken();
  
  // Only include Authorization header if token exists
  if (!token) {
    return { 'Content-Type': 'application/json' };
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Logs in with password or access key
 * @param {string} password - Password for authentication
 * @param {string} accessKey - One-time access key (optional)
 * @returns {Promise<Object>} Login result
 */
export const login = async (password, accessKey) => {
  let url = '/api/auth/login';
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  };
  
  // Add access key to URL if provided
  if (accessKey) {
    url += `?access_key=${encodeURIComponent(accessKey)}`;
  }
  
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Login failed');
  }
  
  const data = await response.json();
  if (data.success && data.token) {
    storeToken(data.token, data.expiresAt);
    return data;
  } else {
    throw new Error(data.error || 'Invalid login response');
  }
};

/**
 * Logs out the current session
 * @returns {Promise<void>}
 */
export const logout = async () => {
  const token = getToken();
  if (!token) return;
  
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearToken();
  }
};

/**
 * Validates the current session token
 * @returns {Promise<boolean>} True if valid
 */
export const validateSession = async () => {
  const token = getToken();
  if (!token) return false;
  
  try {
    const response = await fetch('/api/auth/validate', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
};
