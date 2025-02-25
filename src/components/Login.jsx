import React, { useState, useEffect } from 'react';
import { login, validateSession } from '../lib/auth';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';

const Login = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessKey, setAccessKey] = useState('');

  // Check for access key in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('access_key');
    if (key) {
      setAccessKey(key);
      // Remove from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Auto-login with access key
      handleLogin(null, key);
    }
    
    // Check if already logged in
    const checkSession = async () => {
      try {
        const isValid = await validateSession();
        if (isValid) {
          onLoginSuccess();
        }
      } catch (error) {
        console.error('Session validation error:', error);
      }
    };
    
    checkSession();
  }, [onLoginSuccess]);

  const handleLogin = async (e, key = null) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Use provided access key or the one from state
      const useKey = key || accessKey;
      
      // If we have an access key, use it directly
      if (useKey) {
        const result = await login('', useKey);
        setLoading(false);
        onLoginSuccess(result);
        return;
      }
      
      // Otherwise use password
      if (!password.trim()) {
        setError('Password is required');
        setLoading(false);
        return;
      }
      
      const result = await login(password);
      setLoading(false);
      onLoginSuccess(result);
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Discord Bot Manager</h1>
          <p className="text-muted-foreground mt-2">Please log in to continue</p>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter admin password"
              disabled={loading || !!accessKey}
            />
          </div>
          
          <div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || (!password.trim() && !accessKey)}
            >
              {loading ? 'Logging in...' : 'Log In'}
            </Button>
          </div>
          
          {accessKey && (
            <p className="text-sm text-center text-muted-foreground">
              Logging in with access key...
            </p>
          )}
          
          {process.env.NODE_ENV !== 'production' && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setPassword('dev')}
                className="text-sm text-primary hover:underline"
              >
                Use development login
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
