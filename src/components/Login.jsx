import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { storeToken, hasToken, getToken } from '../lib/auth';

export default function Login({ onLogin }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Check if token exists in URL or localStorage on mount
  useEffect(() => {
    // Check if we already have a token
    if (hasToken()) {
      handleLogin(getToken());
    }
    
    // Extract token from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    
    if (urlToken) {
      setToken(urlToken);
      handleLogin(urlToken);
      
      // Remove token from URL for security
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);
  
  const handleLogin = async (tokenToUse) => {
    setLoading(true);
    setError('');
    
    try {
      // Clean the token and ensure it's properly formatted
      const cleanToken = tokenToUse.trim();
      
      // Test the token with a simple API call
      const response = await fetch('/api/status', {
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // Store token and notify parent component
        storeToken(tokenToUse);
        onLogin(tokenToUse);
      } else {
        const data = await response.json();
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError(`Connection error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Please enter your Discord bot token');
      return;
    }
    
    handleLogin(token);
  };
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg border p-6 shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Discord Bot Manager</h1>
          <p className="mt-2 text-gray-600">Please enter your Discord bot token to continue</p>
        </div>
        
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700">
              Discord Bot Token
            </label>
            <input
              id="token"
              name="token"
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              placeholder="Enter your Discord bot token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          
          <div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Login'}
            </Button>
          </div>
        </form>
        
        <div className="mt-4 text-center text-sm text-gray-600">
          <p>Need help? Check the <a href="https://discord.com/developers/applications" className="text-indigo-600 hover:text-indigo-500" target="_blank" rel="noreferrer">Discord Developer Portal</a></p>
        </div>
      </div>
    </div>
  );
}
