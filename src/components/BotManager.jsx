import React, { useState, useEffect } from 'react';
import { AlertCircle, Send, Trash2, RefreshCw, List } from 'lucide-react';

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

  const styles = {
    container: {
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
    },
    card: {
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
    },
    title: {
      fontSize: '24px',
      fontWeight: 'bold',
    },
    button: {
      padding: '8px 16px',
      borderRadius: '4px',
      border: '1px solid #ccc',
      cursor: 'pointer',
    },
    textarea: {
      width: '100%',
      minHeight: '100px',
      padding: '8px',
      marginBottom: '16px',
      borderRadius: '4px',
      border: '1px solid #ccc',
    },
    select: {
      padding: '8px',
      borderRadius: '4px',
      border: '1px solid #ccc',
    },
    error: {
      color: 'red',
      marginTop: '16px',
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/logs', {
        headers: {
          'Authorization': `Bearer ${process.env.DISCORD_TOKEN}`
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
      const response = await fetch('/api/channels', {
        headers: {
          'Authorization': `Bearer ${process.env.DISCORD_TOKEN}`
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
          'Authorization': `Bearer ${process.env.DISCORD_TOKEN}`
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

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Discord Bot Manager</h1>
          <div>
            <select 
              style={styles.select}
              value={status} 
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="online">Online</option>
              <option value="idle">Idle</option>
              <option value="dnd">Do Not Disturb</option>
              <option value="invisible">Invisible</option>
            </select>
          </div>
        </div>

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
              style={styles.button}
              onClick={() => setMessage('')}
            >
              Clear
            </button>
            <button
              style={styles.button}
              onClick={handleSendMessage}
              disabled={!message.trim()}
            >
              Send Message
            </button>
          </div>

          <div style={{ marginTop: '20px' }}>
            <h3>Bot Logs</h3>
            <button
              style={styles.button}
              onClick={fetchLogs}
              disabled={loading}
            >
              Refresh
            </button>
            <div style={{ 
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '10px',
              marginTop: '10px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <div key={index} style={{ padding: '4px 0' }}>
                    {JSON.stringify(log)}
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  No logs available
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <h3>Command Output</h3>
            <div style={{
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '10px',
              minHeight: '100px'
            }}>
              {output || (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  No output to display
                </div>
              )}
            </div>
          </div>

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
