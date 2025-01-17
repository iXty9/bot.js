import React, { useState, useEffect } from 'react';
import { QueryClientProvider, QueryClient, useQueryClient } from '@tanstack/react-query';
import { useSocket, initializeSocket } from '../lib/socket';
import { useMessageHistory, useSendMessage, useChannels, useError } from '../lib/hooks';
import { Send, Trash2, Command, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const BotManager = () => {
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState([]);
  const [output, setOutput] = useState('');
  
  // Clear output after delay
  useEffect(() => {
    if (output) {
      const timer = setTimeout(() => {
        setOutput('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [output]);
  const [status, setStatus] = useState('online');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState('Messages');
  const [commands, setCommands] = useState([
    { name: '/fact', description: 'Get a random fact', code: 'fetchRandomFact()' }
  ]);

  const styles = {
    container: {
      width: '100%',
      height: '100vh',
      maxWidth: '1290px',
      maxHeight: '760px',
      margin: '0 auto',
      padding: 'clamp(0.5rem, 2vw, 2rem)',
      display: 'flex',
      flexDirection: 'column',
      background: 'hsl(var(--background))',
      overflow: 'hidden',
    },
    card: {
      background: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 'clamp(0.75rem, 1.5vw, 1.5rem)',
      padding: 'clamp(1rem, 2vw, 2rem)',
      marginBottom: 'clamp(1rem, 2vw, 2rem)',
      boxShadow: '0 8px 16px -4px rgb(0 0 0 / 0.2), 0 4px 8px -4px rgb(0 0 0 / 0.15)',
      flex: 1,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2rem',
      padding: '0.5rem 0',
      borderBottom: '2px solid var(--border-color)',
    },
    title: {
      fontSize: '28px',
      fontWeight: 'bold',
      color: 'var(--text-primary)',
      margin: 0,
    },
    button: {
      padding: '10px 20px',
      borderRadius: '0.75rem',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '500',
      transition: 'all 0.2s ease',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      background: 'hsla(var(--secondary), 0.9)',
      color: 'hsl(var(--secondary-foreground))',
      '&:hover': {
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
      },
    },
    textarea: {
      width: '100%',
      minHeight: '120px',
      padding: '1rem',
      marginBottom: '1.25rem',
      borderRadius: '0.75rem',
      border: '1px solid hsl(var(--border))',
      background: 'hsla(var(--secondary), 0.9)',
      color: 'hsl(var(--secondary-foreground))',
      fontSize: '0.95rem',
      lineHeight: '1.5',
      resize: 'vertical',
      transition: 'all 0.2s ease',
      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
      '&:focus': {
        outline: 'none',
        borderColor: 'hsl(var(--primary))',
        boxShadow: '0 0 0 2px hsla(var(--primary), 0.2)',
      },
    },
    select: {
      padding: '0.75rem 1rem',
      borderRadius: '0.75rem',
      border: '1px solid hsl(var(--border))',
      background: 'hsl(var(--secondary))',
      color: 'hsl(var(--secondary-foreground))',
      fontSize: '0.95rem',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
      '&:focus': {
        outline: 'none',
        borderColor: 'hsl(var(--primary))',
        boxShadow: '0 0 0 2px hsla(var(--primary), 0.2)',
      },
    },
    error: {
      color: 'red',
      marginTop: '16px',
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('discord_token') || process.env.DISCORD_TOKEN;
      const response = await fetch('/api/logs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setLogs(data.logs);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setLocalError(`Failed to load logs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      if (mounted && !initialized) {
        setIsLoading(true);
        try {
          const envResponse = await fetch('/api/env');
          const envData = await envResponse.json();
          setEnvVars((prevEnvVars) => ({ ...prevEnvVars, ...envData }));
          if (envData.BOT_NAME) {
            setEnvVars((prevEnvVars) => ({ ...prevEnvVars, BOT_NAME: envData.BOT_NAME }));
          }
          await fetchLogs();
          setInitialized(true);
        } catch (error) {
          console.error('Error fetching initial data:', error);
          setLocalError('Failed to load initial data. Please check your server connection.');
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    fetchData();
    
    // Cleanup function
    return () => {
      mounted = false;
    };
  }, [initialized]);

  // Reset thread when channel changes
  useEffect(() => {
    setSelectedThread(null);
  }, [selectedChannel]);

  const handleStatusChange = async (newStatus) => {
    try {
      setLocalError('');
      const token = localStorage.getItem('discord_token') || process.env.DISCORD_TOKEN;
      const response = await fetch('/api/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatus(newStatus);
      setOutput(`Status changed to ${newStatus}`);
    } catch (err) {
      console.error('Status change error:', err);
      setLocalError(err.message || 'Failed to update status');
      throw err; // Re-throw to handle in the UI
    }
  };

  const queryClient = useQueryClient();
  const { mutate: sendMessage, isLoading: isSending } = useSendMessage();
  const { data: channels = [], isLoading: isLoadingChannels } = useChannels();
  const { data: messages = [], isLoading: isLoadingMessages } = useMessageHistory(selectedChannel?.id);
  const { error, handleError } = useError();
  const [editingMessage, setEditingMessage] = useState(null);
  const [envVars, setEnvVars] = useState({
    API_PORT: '',
    API_HOST: '',
    DISCORD_TOKEN: '',
    JWT_SECRET: '',
    WEBHOOK_URL: '',
    BOT_NAME: ''
  });

  const fetchEnvVars = async () => {
    try {
      const response = await fetch('/api/env');
      if (!response.ok) {
        throw new Error(`Failed to fetch environment variables: ${response.statusText}`);
      }
      const data = await response.json();
      setEnvVars((prevEnvVars) => ({ ...prevEnvVars, ...data }));
      setLocalError(''); // Clear any previous errors
    } catch (error) {
      console.error('Error fetching environment variables:', error);
      setLocalError('Failed to load environment variables');
    }
  };
  const handleSendMessage = async () => {
    if (!message.trim() || !selectedChannel) return;
    
    try {
      await sendMessage({
        message: message.trim(),
        channelId: selectedChannel.id,
        threadId: selectedThread?.id
      }, {
        onSuccess: () => {
          setMessage('');
          setOutput('Message sent successfully!');
          // Refetch messages after sending
          queryClient.invalidateQueries(['messages', selectedChannel.id]);
        },
        onError: (error) => {
          handleError(error);
          setOutput('Failed to send message');
        }
      });
    } catch (error) {
      handleError(error);
    }
  };

  useEffect(() => {
    // Get token from URL if present
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('discord_token', token);
      // Remove token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Initialize WebSocket connection
    const storedToken = localStorage.getItem('discord_token') || process.env.DISCORD_TOKEN;
    if (storedToken) {
      const socket = initializeSocket(storedToken);
      
      socket.on('message', (data) => {
        setLogs((prev) => [data, ...prev].slice(0, 50));
      });
      
      socket.on('status', (data) => {
        setStatus(data.status);
      });
      
      return () => {
        socket.disconnect();
      };
    }
  }, []);

  // Loading state handled by parent Suspense

  if (isLoading) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))'
      }}>
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          background: 'hsl(var(--card))',
          borderRadius: 'var(--radius)',
          boxShadow: '0 8px 16px -4px rgb(0 0 0 / 0.2)'
        }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, position: 'relative' }}>
        <div style={{
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{ 
            display: 'flex',
            gap: '8px',
            background: 'hsl(var(--muted))',
            padding: '3px',
            borderRadius: '0.75rem',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2)',
          }}>
            {['Messages', 'Logs', 'Slash Commands', 'Configuration'].map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? "default" : "ghost"}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === 'Configuration') {
                    fetchEnvVars();
                  }
                }}
                className="px-4 py-2 rounded-md"
              >
                {tab}
              </Button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {envVars.BOT_NAME || 'Bot'}
            </span>
            <select 
              style={{
                ...styles.select,
                padding: '0.5rem 2.5rem 0.5rem 1rem',
                borderRadius: '0.75rem',
                background: 'hsl(var(--secondary))',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.5rem center',
                backgroundSize: '1rem',
              }}
              value={status}
              onChange={async (e) => {
                try {
                  await handleStatusChange(e.target.value);
                } catch (err) {
                  console.error('Failed to change status:', err);
                }
              }}
            >
              <option value="online">
                ⬤ Online
              </option>
              <option value="idle">
                🌙 Idle
              </option>
              <option value="dnd">
                ⛔ Do Not Disturb
              </option>
              <option value="invisible">
                ⭕ Invisible
              </option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          {activeTab === 'Logs' && (
            <>
              <div style={{ height: '460px' }}>
                <div style={{ 
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  height: '460px',
                  fontSize: '0.9rem',
                  color: 'hsl(var(--foreground))',
                  fontFamily: 'monospace',
                  overflowY: 'auto',
                  overflowX: 'hidden'
                }}>
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : Array.isArray(logs) && logs.length > 0 ? (
                    logs.map((log, index) => (
                      <div key={index} className="py-1 border-b border-border/20 last:border-0">
                        <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="mx-2">-</span>
                        <span>{typeof log === 'object' && log.log ? log.log : String(log)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No logs available
                    </div>
                  )}
                </div>
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    style={{
                      ...styles.button,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--primary)',
                      color: 'white'
                    }}
                    onClick={fetchLogs}
                    aria-label="Refresh Logs"
                  >
                    <RefreshCw size={16} />
                    Refresh Logs
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'Messages' && (
            <div className="space-y-4">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-10 mb-4">
                <Select
                  value={selectedChannel?.id || ""}
                  onValueChange={(value) => {
                      const channel = channels?.find(c => c.id === value);
                      setSelectedChannel(channel || null);
                      setSelectedThread(null); // Reset thread when channel changes
                    }}
                    disabled={isLoadingChannels}
                  >
                    <SelectTrigger
                      className="w-full"
                      style={{
                        padding: '0.5rem 2.5rem 0.5rem 1rem',
                        borderRadius: '0.75rem',
                        background: 'hsl(var(--secondary))',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.5rem center',
                        backgroundSize: '1rem',
                      }}
                    aria-label="Select a channel"
                    >
                      <SelectValue placeholder="Select a channel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(channels) && channels.map(channel => (
                        <SelectItem key={channel.id} value={channel.id}>
                          {channel.name} ({channel.guildName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                <Select
                    value={selectedThread?.id || "no_thread"}
                    onValueChange={(value) => {
                      if (value === "no_thread") {
                        setSelectedThread(null);
                        return;
                      }
                      const thread = selectedChannel?.threads?.find(t => t.id === value);
                      setSelectedThread(thread || null);
                    }}
                    disabled={!selectedChannel}
                  >
                    <SelectTrigger
                      className="w-full"
                      style={{
                        padding: '0.5rem 2.5rem 0.5rem 1rem',
                        borderRadius: '0.75rem',
                        background: 'hsl(var(--secondary))',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.5rem center',
                        backgroundSize: '1rem',
                      }}
                    >
                      <SelectValue placeholder="Select a thread..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_thread">No thread</SelectItem>
                      {selectedChannel?.threads?.map(thread => (
                        <SelectItem key={thread.id} value={thread.id}>
                          {thread.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Textarea
                  placeholder={selectedChannel ? "Type your message here..." : "Select a channel first..."}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={!selectedChannel}
                  style={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    height: '460px',
                    fontSize: '0.9rem',
                    color: 'hsl(var(--foreground))',
                    fontFamily: 'monospace',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    resize: 'none',
                  }}
                />

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    style={{
                      ...styles.button,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onClick={() => setMessage('')}
                  >
                    <Trash2 size={16} />
                    Clear
                  </button>
                  <Button
                    style={{
                      ...styles.button,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onClick={handleSendMessage}
                    disabled={!message.trim() || isSending}
                  >
                      {isSending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          Send Message
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
          )}

          {activeTab === 'Slash Commands' && (
            <div style={{ height: '460px' }}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Slash Commands</h3>
                <Button
                  onClick={() => setCommands([...commands, { name: '', description: '', options: [] }])}
                  className="gap-2"
                >
                  <Command size={16} />
                  Add Command
                </Button>
              </div>
              <div className="bg-card border border-border rounded-lg p-4 space-y-4 h-[calc(460px-4rem)] overflow-y-auto">
                {commands.length > 0 ? (
                  commands.map((cmd, index) => (
                    <div key={index} style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
                      <input
                        type="text"
                        placeholder="Command name"
                        value={cmd.name}
                        onChange={(e) => {
                          setCommands((prevCommands) => {
                            const newCommands = [...prevCommands];
                            newCommands[index].name = e.target.value;
                            return newCommands;
                          });
                        }}
                        style={{
                          ...styles.select,
                          flex: '1'
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Command description"
                        value={cmd.description}
                        onChange={(e) => {
                          const newCommands = [...commands];
                          newCommands[index].description = e.target.value;
                          setCommands(newCommands);
                        }}
                        style={{
                          ...styles.select,
                          flex: '2'
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Command code"
                        value={cmd.code}
                        onChange={(e) => {
                          const newCommands = [...commands];
                          newCommands[index].code = e.target.value;
                          setCommands(newCommands);
                        }}
                        style={{
                          ...styles.select,
                          flex: '3'
                        }}
                      />
                      <button
                        onClick={() => {
                          const newCommands = commands.filter((_, i) => i !== index);
                          setCommands(newCommands);
                        }}
                        style={{
                          ...styles.button,
                          backgroundColor: 'var(--destructive)',
                          color: 'white'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                    No slash commands configured. Click "Add Command" to create one.
                  </div>
                )}
              </div>
              {commands.length > 0 && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    style={{
                      ...styles.button,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--primary)',
                      color: 'white'
                    }}
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/commands', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('discord_token') || process.env.DISCORD_TOKEN}`
                          },
                          body: JSON.stringify({ commands })
                        });
                        if (response.ok) {
                          setError('');
                          setOutput('Slash commands updated successfully');
                        } else {
                          throw new Error('Failed to update slash commands');
                        }
                      } catch (err) {
                        setLocalError('Failed to update slash commands');
                      }
                    }}
                  >
                    Save Commands
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Configuration' && (
            <div style={{ height: '460px' }}>
              <div className="flex flex-col space-y-4">
                {['API_PORT', 'API_HOST', 'DISCORD_TOKEN', 'JWT_SECRET', 'WEBHOOK_URL'].map((envVar) => (
                  <div key={envVar} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ flex: '1', fontWeight: 'bold' }}>{envVar}</label>
                    <div style={{ display: 'flex', alignItems: 'center', flex: '2' }}>
                      <input
                        type={envVar.includes('TOKEN') || envVar.includes('SECRET') ? 'password' : 'text'}
                        value={envVars[envVar] || ''}
                        onChange={(e) => setEnvVars({ ...envVars, [envVar]: e.target.value })}
                        style={{
                          ...styles.select,
                          flex: '1',
                          padding: '0.5rem',
                        }}
                      />
                      {envVar.includes('TOKEN') || envVar.includes('SECRET') && (
                        <button
                          onClick={(e) => {
                            const input = e.target.previousSibling;
                            input.type = input.type === 'password' ? 'text' : 'password';
                            e.target.textContent = input.type === 'password' ? 'Show' : 'Hide';
                          }}
                          style={{
                            ...styles.button,
                            padding: '0.5rem',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            marginLeft: '0.5rem'
                          }}
                        >
                          Show
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    style={{
                      ...styles.button,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--primary)',
                      color: 'white'
                    }}
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/env', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify(envVars),
                        });
                        if (!response.ok) {
                          throw new Error('Failed to update configuration');
                        }
                        setOutput('Configuration updated successfully and service restarted');
                        setLocalError('');
                      } catch (err) {
                        setLocalError('Failed to update configuration');
                      }
                    }}
                  >
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          )}
            {activeTab === 'Configuration' && localError && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{localError}</AlertDescription>
              </Alert>
            )}
        </div>
      </div>
    </div>
  );
};

export default BotManager;
