// Mock API for development purposes
// This file provides mock implementations of the API endpoints
// to allow development without a backend server

const MOCK_DELAY = 500; // Simulate network delay

// Mock data
const mockChannels = [
  { id: '1', name: 'general', type: 'text', guildId: '101', guildName: 'Development Server' },
  { id: '2', name: 'random', type: 'text', guildId: '101', guildName: 'Development Server' },
  { id: '3', name: 'announcements', type: 'text', guildId: '101', guildName: 'Development Server' },
  { id: '4', name: 'forum-channel', type: 'forum', guildId: '101', guildName: 'Development Server', threads: [
    { id: '41', name: 'Thread 1', parentId: '4' },
    { id: '42', name: 'Thread 2', parentId: '4' }
  ]}
];

const mockMessages = {
  '1': [
    { id: '101', content: 'Hello world!', author: 'Bot', timestamp: Date.now() - 60000 },
    { id: '102', content: 'This is a test message', author: 'User', timestamp: Date.now() - 30000 }
  ],
  '2': [
    { id: '201', content: 'Random channel message', author: 'Bot', timestamp: Date.now() - 120000 }
  ],
  '3': [
    { id: '301', content: 'Important announcement!', author: 'Admin', timestamp: Date.now() - 3600000 }
  ],
  '41': [
    { id: '401', content: 'Thread 1 message', author: 'Bot', timestamp: Date.now() - 7200000 }
  ],
  '42': [
    { id: '501', content: 'Thread 2 message', author: 'User', timestamp: Date.now() - 14400000 }
  ]
};

const mockLogs = [
  { log: 'Bot started', timestamp: Date.now() - 3600000 },
  { log: 'Connected to Discord', timestamp: Date.now() - 3500000 },
  { log: 'Joined server: Development Server', timestamp: Date.now() - 3400000 }
];

// Mock API handlers
export const setupMockApi = () => {
  // Only setup mock API if we're in development and there's no real API
  if (process.env.NODE_ENV !== 'development' || window.location.hostname !== 'localhost') {
    return;
  }

  console.log('Setting up mock API for development');

  // Mock fetch
  const originalFetch = window.fetch;
  window.fetch = async (url, options = {}) => {
    // Parse the URL
    const urlObj = new URL(url, window.location.origin);
    const path = urlObj.pathname;
    const params = Object.fromEntries(urlObj.searchParams);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));

    // Mock API endpoints
    if (path === '/api/channels') {
      return mockResponse({ success: true, channels: mockChannels });
    }

    if (path === '/api/messages') {
      const channelId = params.channelId;
      const threadId = params.threadId;
      const targetId = threadId || channelId;
      const messages = mockMessages[targetId] || [];
      return mockResponse({ success: true, messages });
    }

    if (path === '/api/send' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      const { message, channelId, threadId } = body;
      const targetId = threadId || channelId;
      
      // Add the message to mock data
      const newMessage = {
        id: Date.now().toString(),
        content: message,
        author: 'You',
        timestamp: Date.now()
      };
      
      if (mockMessages[targetId]) {
        mockMessages[targetId].push(newMessage);
      } else {
        mockMessages[targetId] = [newMessage];
      }
      
      return mockResponse({ success: true, message: newMessage });
    }

    if (path === '/api/logs') {
      return mockResponse({ logs: mockLogs });
    }

    if (path === '/api/env') {
      return mockResponse({
        API_PORT: '3000',
        API_HOST: 'localhost',
        BOT_NAME: 'Development Bot',
        DISCORD_TOKEN_SET: true
      });
    }

    if (path === '/api/env/check') {
      return mockResponse({ hasToken: true });
    }

    if (path === '/api/status' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      return mockResponse({ success: true, status: body.status });
    }

    // If no mock handler, pass through to original fetch
    return originalFetch(url, options);
  };

  // Helper to create a mock response
  function mockResponse(data, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
      text: async () => JSON.stringify(data)
    };
  }
};
