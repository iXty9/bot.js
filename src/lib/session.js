// Session management utilities for the web UI
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// In-memory store of active sessions (would be replaced with Redis/DB in production)
const activeSessions = new Map();

// Generate a random secret if not provided in environment
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

/**
 * Creates a new session for a user
 * @returns {Object} Session info with token
 */
export const createSession = () => {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  const sessionInfo = {
    id: sessionId,
    createdAt: Date.now(),
    expiresAt,
    lastActivity: Date.now()
  };
  
  // Store session
  activeSessions.set(sessionId, sessionInfo);
  
  // Create JWT token
  const token = jwt.sign(
    { sessionId },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  return {
    token,
    expiresAt
  };
};

/**
 * Validates a session token
 * @param {string} token - JWT token
 * @returns {boolean} True if valid
 */
export const validateSession = (token) => {
  try {
    // Verify JWT signature and expiration
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if session exists in our store
    const session = activeSessions.get(decoded.sessionId);
    if (!session) {
      return false;
    }
    
    // Check if session has expired
    if (session.expiresAt < Date.now()) {
      activeSessions.delete(decoded.sessionId);
      return false;
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    activeSessions.set(decoded.sessionId, session);
    
    return true;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
};

/**
 * Invalidates a session
 * @param {string} token - JWT token
 */
export const invalidateSession = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    activeSessions.delete(decoded.sessionId);
    return true;
  } catch (error) {
    return false;
  }
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
