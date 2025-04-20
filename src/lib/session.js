import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Only log to console if DEBUG=true
function debugLog(message) {
  if (process.env.DEBUG === 'true') {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

// Logging utility to write to log file only
const logFilePath = path.resolve(process.cwd(), 'console.log');
function logToFile(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFilePath, `${timestamp} - [Session] ${message}\n`);
}

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

  logToFile(`Creating new session (ID length: ${sessionId.length} chars)`);
  logToFile(`Using JWT_SECRET (length: ${JWT_SECRET.length} characters)`);
  logToFile(`JWT library version: ${jwt.version || 'unknown'}`);
  logToFile(`Using algorithm: HS256`);
  debugLog(`Creating new session (ID length: ${sessionId.length} chars)`);
  debugLog(`Using JWT_SECRET (length: ${JWT_SECRET.length} characters)`);
  debugLog(`JWT library version: ${jwt.version || 'unknown'}`);
  debugLog(`Using algorithm: HS256`);

  // Create JWT token
  const token = jwt.sign(
    { sessionId },
    JWT_SECRET,
    { 
      expiresIn: '24h',
      algorithm: 'HS256'  // Explicitly set algorithm
    }
  );

  logToFile(`Session token created, expires in 24 hours`);
  debugLog(`Session token created, expires in 24 hours`);

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
    if (!token) {
      logToFile('No token provided for validation');
      debugLog('No token provided for validation');
      return false;
    }

    // Verify JWT signature and expiration
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    if (!decoded || !decoded.sessionId) {
      logToFile('Invalid token format: missing sessionId');
      debugLog('Invalid token format: missing sessionId');
      return false;
    }

    // Check if session exists in our store
    const session = activeSessions.get(decoded.sessionId);
    if (!session) {
      logToFile('Session not found in active sessions');
      debugLog('Session not found in active sessions');
      return false;
    }

    // Check if session has expired
    if (session.expiresAt < Date.now()) {
      logToFile('Session has expired');
      debugLog('Session has expired');
      activeSessions.delete(decoded.sessionId);
      return false;
    }

    // Update last activity
    session.lastActivity = Date.now();
    activeSessions.set(decoded.sessionId, session);

    return true;
  } catch (error) {
    logToFile(`Session validation error: ${error.message}`);
    debugLog(`Session validation error: ${error.message}`);
    if (error.name === 'JsonWebTokenError') {
      logToFile(`JWT validation failed: ${error.message}`);
      debugLog(`JWT validation failed: ${error.message}`);
    } else if (error.name === 'TokenExpiredError') {
      logToFile('Token has expired');
      debugLog('Token has expired');
    }
    return false;
  }
};

/**
 * Invalidates a session
 * @param {string} token - JWT token
 */
export const invalidateSession = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
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
