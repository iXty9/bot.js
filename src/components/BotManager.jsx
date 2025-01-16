import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Send, Trash2, Command, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

// Lazy load components
const Tabs = lazy(() => import('./ui/tabs').then(module => ({ 
  default: module.Tabs,
  TabsContent: module.TabsContent,
  TabsList: module.TabsList,
  TabsTrigger: module.TabsTrigger 
})));

const Select = lazy(() => import('./ui/select').then(module => ({
  default: module.Select,
  SelectContent: module.SelectContent,
  SelectItem: module.SelectItem,
  SelectTrigger: module.SelectTrigger,
  SelectValue: module.SelectValue
})));

const Alert = lazy(() => import('./ui/alert').then(module => ({
  default: module.Alert,
  AlertDescription: module.AlertDescription
})));

const Textarea = lazy(() => import('./ui/textarea').then(module => ({
  default: module.Textarea
})));

const BotManager = () => {
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState([]);
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('online');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [activeTab, setActiveTab] = useState('messages');
  const [commands, setCommands] = useState([]);

  const styles = {
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '2rem',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'hsl(var(--background))',
    },
    card: {
      background: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '1.5rem',
      padding: '2rem',
      marginBottom: '2rem',
      boxShadow: '0 8px 16px -4px rgb(0 0 0 / 0.2), 0 4px 8px -4px rgb(0 0 0 / 0.15)',
      flex: 1,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
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
      background: 'hsl(var(--secondary))',
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
      background: 'hsl(var(--secondary))',
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
      setError(`Failed to load logs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const token = localStorage.getItem('discord_token') || process.env.DISCORD_TOKEN;
      const response = await fetch('/api/channels', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setChannels(data);
    } catch (err) {
      console.error('Error fetching channels:', err);
      setError('Failed to load channels');
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchChannels();
  }, []);

  // Reset thread when channel changes
  useEffect(() => {
    setSelectedThread(null);
  }, [selectedChannel]);

  const handleStatusChange = async (newStatus) => {
    try {
      const response = await fetch('/api/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('discord_token') || process.env.DISCORD_TOKEN}`
        },
        body: JSON.stringify({ newStatus })
      });
      const data = await response.json();
      setStatus(newStatus);
      setOutput(`Status changed to ${newStatus}`);
    } catch (err) {
      setError('Failed to update status');
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedChannel) return;
    
    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DISCORD_TOKEN}`
        },
        body: JSON.stringify({
          message,
          channelId: selectedChannel.id,
          threadId: selectedThread?.id
        })
      });
      const data = await response.json();
      setOutput('Message sent successfully');
      setMessage('');
    } catch (err) {
      setError('Failed to send message');
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
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
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
            gap: '2px',
            background: 'hsl(var(--muted))',
            padding: '4px',
            borderRadius: '1rem',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2)',
          }}>
            <button
              style={{
                background: activeTab === 'messages' ? 'hsl(var(--background))' : 'transparent',
                color: activeTab === 'messages' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontWeight: 500,
                transition: 'all 0.15s ease'
              }}
              onClick={() => setActiveTab('messages')}
            >
              Messages
            </button>
            <button
              style={{
                color: activeTab === 'logs' ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'logs' ? '2px solid var(--primary)' : 'none',
                padding: '0.5rem 1rem'
              }}
              onClick={() => setActiveTab('logs')}
            >
              Logs
            </button>
            <button
              style={{
                color: activeTab === 'commands' ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'commands' ? '2px solid var(--primary)' : 'none',
                padding: '0.5rem 1rem'
              }}
              onClick={() => setActiveTab('commands')}
            >
              Slash Commands
            </button>
          </div>
          <div>
            <select 
              style={{
                ...styles.select,
                padding: '0.5rem 1rem',
                paddingRight: '2.5rem',
                borderRadius: '0.75rem',
                background: 'hsl(var(--secondary))',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--foreground))',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              value={status} 
              onChange={(e) => handleStatusChange(e.target.value)}
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
          {activeTab === 'logs' && (
              <div style={{ height: '500px' }}>
                <div style={{ 
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  height: '400px',
                  overflowY: 'auto',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  fontFamily: 'monospace'
                }}>
                  {Array.isArray(logs) && logs.length > 0 ? (
                    logs.map((log, index) => (
                      <div key={index} style={{ padding: '4px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {typeof log === 'object' && log.log ? log.log : String(log)}
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
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
                  >
                    <RefreshCw size={16} />
                    Refresh Logs
                  </button>
                </div>
              </div>
          )}

          {activeTab === 'messages' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <select
                    style={{ ...styles.select, marginRight: '8px' }}
                    value={selectedChannel?.id || ''}
                    onChange={(e) => {
                      const channel = channels.find(c => c.id === e.target.value);
                      setSelectedChannel(channel);
                    }}
                  >
                    <option value="">Select a channel...</option>
                    {channels.map(channel => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name} ({channel.guildName})
                      </option>
                    ))}
                  </select>

                  {selectedChannel?.type === 'forum' && (
                    <select
                      style={styles.select}
                      value={selectedThread?.id || ''}
                      onChange={(e) => {
                        const thread = selectedChannel.threads.find(t => t.id === e.target.value);
                        setSelectedThread(thread);
                      }}
                    >
                      <option value="">Select a thread...</option>
                      {selectedChannel.threads.map(thread => (
                        <option key={thread.id} value={thread.id}>
                          {thread.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <textarea
                  style={styles.textarea}
                  placeholder={selectedChannel ? "Type your message here..." : "Select a channel first..."}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={!selectedChannel}
                />
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
                  <button
                    style={{
                      ...styles.button,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--primary)',
                      color: 'white'
                    }}
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                  >
                    <Send size={16} />
                    Send Message
                  </button>
                </div>

                <div style={{ height: '500px', overflowY: 'auto', marginTop: '20px' }}>
                  {/* Message history would go here */}
                </div>
              </div>
          )}

          {activeTab === 'commands' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3>Slash Commands</h3>
                  <button
                    style={{
                      ...styles.button,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--primary)',
                      color: 'white'
                    }}
                    onClick={() => setCommands([...commands, { name: '', description: '' }])}
                  >
                    <Command size={16} />
                    Add Command
                  </button>
                </div>
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '1rem',
                }}>
                  {commands.length > 0 ? (
                    commands.map((cmd, index) => (
                      <div key={index} style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
                        <input
                          type="text"
                          placeholder="Command name"
                          value={cmd.name}
                          onChange={(e) => {
                            const newCommands = [...commands];
                            newCommands[index].name = e.target.value;
                            setCommands(newCommands);
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
                          setError('Failed to update slash commands');
                        }
                      }}
                    >
                      Save Commands
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div style={styles.error}>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
  );
};

export default BotManager;
