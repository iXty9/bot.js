import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE = '/api';

export const useMessageHistory = (channelId) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['messages', channelId],
    queryFn: async () => {
      if (!channelId) return [];
      const { data } = await axios.get(`${API_BASE}/messages/${channelId}`);
      return data;
    },
    enabled: !!channelId,
    staleTime: 30000,
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ message, channelId, threadId }) => {
      const { data } = await axios.post(`${API_BASE}/send`, {
        message,
        channelId,
        threadId
      });
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['messages', variables.channelId]);
    },
  });
};

export const useChannels = () => {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const token = localStorage.getItem('discord_token') || process.env.DISCORD_TOKEN;
      const { data } = await axios.get(`${API_BASE}/channels`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return data;
    },
    staleTime: 60000,
  });
};

export const useError = () => {
  const [error, setError] = useState(null);

  const handleError = useCallback((error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    setError(message);
    
    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  }, []);

  return { error, setError, handleError };
};
