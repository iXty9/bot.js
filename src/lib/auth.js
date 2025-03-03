// Authentication utilities for the web UI

/**
 * Stores the session token and API key in localStorage
 * @param {string} token - The session token
 * @param {string} apiKey - The API key
 * @param {number} expiresAt - Expiration timestamp
 */
export const storeToken = (token, apiKey, expiresAt) => {
  if (token) {
    localStorage.setItem('session_token', token);
  }
  
  if (apiKey) {
    localStorage.setItem('api_key', apiKey);
  }
  
  if (expiresAt) {
    localStorage.setItem('session_expires', expiresAt.toString());
  }
  
  console.log('Auth credentials stored, expires:', new Date(expiresAt).toLocaleString());
};

/**
 * Retrieves the session token from localStorage
 * @returns {string|null} The stored token or null if not found
 */
export const getToken = () => {
  return localStorage.getItem('session_token');
};

/**
 * Clears all stored authentication credentials
 */
export const clearToken = () => {
  localStorage.removeItem('session_token');
  localStorage.removeItem('session_expires');
  localStorage.removeItem('api_key');
};

/**
 * Checks if authentication credentials are stored and not expired
 * @returns {boolean} True if valid credentials exist
 */
export const hasToken = () => {
  const token = getToken();
  const apiKey = getApiKey();
  
  // If we have an API key, that's sufficient
  if (apiKey) return true;
  
  // Otherwise check token validity
  if (!token) return false;
  
  const expiresAt = localStorage.getItem('session_expires');
  if (expiresAt && parseInt(expiresAt) < Date.now()) {
    clearToken(); // Clear expired token
    return false;
  }
  
  return true;
};

/**
 * Gets the stored API key
 * @returns {string|null} The API key or null
 */
export const getApiKey = () => {
  return localStorage.getItem('api_key');
};

/**
 * Creates headers with authentication
 * @returns {Object} Headers object with authentication
 */
export const getAuthHeaders = () => {
  const apiKey = getApiKey();
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  
  // Include both authentication methods if available
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
    console.log('Added API key to headers');
  }
  
  if (token) {
    // Send token directly without Bearer prefix for compatibility
    headers['Authorization'] = token;
    console.log('Added token to headers');
  }
  
  // Add access key if it exists (for initial auth)
  const accessKey = localStorage.getItem('access_key');
  if (accessKey) {
    headers['X-Access-Key'] = accessKey;
    console.log('Added access key to headers');
  }
  
  // For debugging
  console.log('Auth headers:', Object.keys(headers));
  
  return headers;
};

/**
 * Logs in with password or access key
 * @param {string} password - Password for authentication
 * @param {string} accessKey - One-time access key (optional)
 * @returns {Promise<Object>} Login result
 */
export const login = async (password, accessKey) => {
  let url = '/api/auth/login';
  const headers = { 'Content-Type': 'application/json' };
  
  // Add access key to header if provided
  if (accessKey) {
    headers['X-Access-Key'] = accessKey;
    url += `?access_key=${encodeURIComponent(accessKey)}`;
  }
  
  const options = {
    method: 'POST',
    headers,
    body: JSON.stringify({ password })
  };
  
  console.log('Login request:', { url, hasAccessKey: !!accessKey });
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Login failed:', response.status, errorText);
      throw new Error(errorText || `Login failed with status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Login response:', { success: data.success, hasToken: !!data.token, hasApiKey: !!data.apiKey });
    
    if (data.success) {
      // Store both token and API key
      storeToken(data.token, data.apiKey, data.expiresAt);
      
      // Also store access key temporarily if it was used
      if (accessKey) {
        localStorage.setItem('access_key', accessKey);
        // Remove it after 1 minute
        setTimeout(() => {
          localStorage.removeItem('access_key');
        }, 60000);
      }
      
      return data;
    } else {
      throw new Error(data.error || 'Invalid login response');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
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
