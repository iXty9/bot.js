import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import axios from 'axios';

// Base URL for API requests
const API_BASE = '/api';

export const useMessageHistory = (channelId, threadId) => {
  return useQuery({
    queryKey: ['messages', channelId, threadId],
    queryFn: async () => {
      if (!channelId) return [];
      
      try {
        const token = localStorage.getItem('discord_token');
        if (!token) {
          console.error('No authentication token available for message history');
          return []; // Return empty array instead of throwing
        }
        
        // Build the URL with proper parameters
        let url = `${API_BASE}/messages`;
        const params = new URLSearchParams();
        params.append('channelId', channelId);
        if (threadId) params.append('threadId', threadId);
        url = `${url}?${params.toString()}`;
        
        console.log(`Fetching messages from: ${url}`);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.error(`Error fetching messages: ${response.status} ${response.statusText}`);
          return []; // Return empty array on error
        }
        
        const data = await response.json();
        console.log(`Received ${data?.messages?.length || 0} messages`);
        
        // Ensure we return an array even if the API response is unexpected
        return Array.isArray(data.messages) ? data.messages : [];
      } catch (error) {
        console.error('Error fetching messages:', error);
        return []; // Return empty array on error
      }
    },
    enabled: !!channelId,
    staleTime: 30000,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchInterval: 30000 // Refresh every 30 seconds
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ message, channelId, threadId }) => {
      if (!message || !channelId) {
        throw new Error('Message and channel ID are required');
      }
      
      const token = localStorage.getItem('discord_token');
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      console.log(`Sending message to channel ${channelId}${threadId ? ` thread ${threadId}` : ''}`);
      
      const response = await fetch(`${API_BASE}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message,
          channelId,
          threadId
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to send message');
      }
      
      return data;
    },
    onSuccess: (data, variables) => {
      console.log('Message sent successfully, invalidating queries');
      queryClient.invalidateQueries(['messages', variables.channelId, variables.threadId]);
    }
  });
};

export const useChannels = () => {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      console.log('Fetching channels from API...');
      
      try {
        const token = localStorage.getItem('discord_token');
        
        if (!token) {
          console.error('No authentication token available for channels');
          return []; // Return empty array instead of throwing
        }
        
        const response = await fetch(`${API_BASE}/channels`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.error(`HTTP error! status: ${response.status}`);
          return []; // Return empty array on error
        }
        
        const data = await response.json();
        
        // Log the response for debugging
        console.log('Channels response:', {
          success: data.success,
          channelCount: data.channels?.length || 0
        });
        
        // Ensure we always return an array
        return Array.isArray(data.channels) ? data.channels : [];
      } catch (error) {
        console.error('Error fetching channels:', error);
        return []; // Return empty array on error
      }
    },
    staleTime: 60000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchInterval: 300000 // Refresh every 5 minutes
  });
};

export const useError = () => {
  const [error, setError] = useState(null);

  const handleError = useCallback((error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    console.error('Error handled:', message);
    setError(message);
    
    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  }, []);

  return { error, setError, handleError };
};

// Direct channel fetching function for debugging
export const fetchChannelsDirectly = async () => {
  try {
    console.log('Directly fetching channels...');
    const token = localStorage.getItem('discord_token');
    
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    const response = await fetch(`${API_BASE}/channels`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Direct channel fetch response:', data);
    
    if (data.success && data.channels) {
      return data.channels;
    } else {
      console.error('API returned success=false or no channels:', data);
      throw new Error(data.error || 'Failed to fetch channels');
    }
  } catch (error) {
    console.error('Direct channel fetch error:', error);
    throw error;
  }
};
