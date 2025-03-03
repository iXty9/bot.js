import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE = '/api';

export const useMessageHistory = (channelId, threadId) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['messages', channelId, threadId],
    queryFn: async () => {
      if (!channelId) return [];
      
      const url = threadId 
        ? `${API_BASE}/messages/${channelId}?threadId=${threadId}`
        : `${API_BASE}/messages/${channelId}`;
        
      console.log(`Fetching messages from: ${url}`);
      
      const token = localStorage.getItem('discord_token') || process.env.DISCORD_TOKEN;
      if (!token) {
        console.error('No authentication token available for message history');
        throw new Error('No authentication token available');
      }
      
      try {
        const { data } = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log(`Received ${data?.messages?.length || 0} messages`);
        return data.messages || [];
      } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }
    },
    enabled: !!channelId,
    staleTime: 30000,
    retry: 2,
    refetchOnWindowFocus: false
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ message, channelId, threadId }) => {
      const token = localStorage.getItem('discord_token') || process.env.DISCORD_TOKEN;
      if (!token) {
        console.error('No authentication token available for sending message');
        throw new Error('No authentication token available');
      }
      
      console.log(`Sending message to channel ${channelId}${threadId ? ` thread ${threadId}` : ''}`);
      
      try {
        const { data } = await axios.post(`${API_BASE}/send`, {
          message,
          channelId,
          threadId
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        return data;
      } catch (error) {
        console.error('Send message error:', error);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      console.log('Message sent successfully, invalidating queries');
      queryClient.invalidateQueries(['messages', variables.channelId, variables.threadId]);
    },
    onError: (error) => {
      console.error('Send message error:', error);
      throw error;
    }
  });
};

export const useChannels = () => {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      console.log('Fetching channels from API...');
      const token = localStorage.getItem('discord_token') || process.env.DISCORD_TOKEN;
      
      if (!token) {
        console.error('No authentication token available for channels');
        throw new Error('No authentication token available');
      }
      
      try {
        // Use fetch instead of axios for more direct control
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
        
        console.log(`Received channels response:`, {
          success: data.success,
          channelCount: data.channels?.length || 0,
          firstChannel: data.channels?.[0]?.name
        });
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch channels');
        }
        
        return data.channels || [];
      } catch (error) {
        console.error('Error fetching channels:', error);
        throw error;
      }
    },
    staleTime: 60000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false
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
    const token = localStorage.getItem('discord_token') || process.env.DISCORD_TOKEN;
    
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
