// Simple authentication utility
import crypto from 'crypto';

// Create a JWT secret if one doesn't exist
if (!process.env.JWT_SECRET) {
  console.log('Using default JWT secret for development');
  process.env.JWT_SECRET = 'default-jwt-secret-for-development-only';
}

// Generate a random API key if not provided in environment
const API_KEY = process.env.API_KEY || crypto.randomBytes(16).toString('hex');

// Export the JWT secret for use in other modules
export const JWT_SECRET = process.env.JWT_SECRET;

// Store active sessions with their expiration times
const activeSessions = new Map();

/**
 * Validates an API key
 * @param {string} key - The API key to validate
 * @returns {boolean} True if valid
 */
export const validateApiKey = (key) => {
  return key === API_KEY || key === global.WEB_UI_ACCESS_KEY;
};

/**
 * Creates a new session
 * @returns {Object} Session info with token
 */
export const createSession = () => {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  const sessionInfo = {
    id: sessionId,
    createdAt: Date.now(),
    expiresAt
  };
  
  // Store session
  activeSessions.set(sessionId, sessionInfo);
  
  console.log(`Created new session (ID length: ${sessionId.length} chars)`);
  
  return {
    token: sessionId,
    expiresAt
  };
};

/**
 * Validates a session token
 * @param {string} token - Session token
 * @returns {boolean} True if valid
 */
export const validateSession = (token) => {
  if (!token) {
    console.log('validateSession: No token provided');
    return false;
  }
  
  // For development purposes, accept any token
  // REMOVE THIS IN PRODUCTION
  console.log('DEVELOPMENT MODE: Validating session');
  return true;
  
  const session = activeSessions.get(token);
  if (!session) {
    console.log(`validateSession: Session not found for provided token`);
    return false;
  }
  
  if (session.expiresAt < Date.now()) {
    console.log('validateSession: Session expired');
    activeSessions.delete(token);
    return false;
  }
  
  console.log('validateSession: Valid session found');
  return true;
};

/**
 * Invalidates a session
 * @param {string} token - Session token
 */
export const invalidateSession = (token) => {
  activeSessions.delete(token);
};

/**
 * Cleans up expired sessions
 */
export const cleanupSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.expiresAt < now) {
      activeSessions.delete(sessionId);
    }
  }
};

// Set up periodic cleanup
setInterval(cleanupSessions, 60 * 60 * 1000); // Every hour

// Export the API key for CLI access
export const getApiKey = () => API_KEY;
