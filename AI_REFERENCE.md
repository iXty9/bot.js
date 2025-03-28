
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                               AI Development Reference                                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛


                                                    Project Overview

Discord bot with console UI and web interface. Manages Discord interactions, provides command handling, and exposes
functionality through an API server.


                                                    Core Components

 • BotManager: Central controller for Discord interactions
 • CommandHandler: Processes user commands from console
 • ConsoleUI: Terminal-based interface
 • API Server: Web interface for remote control


                                                 Architecture Patterns

 • Event-driven communication between components
 • Command pattern for handling user inputs
 • Singleton pattern for BotManager instance


                                                     Key Interfaces

 • BotManager exposes methods for: sending messages, changing status, listing channels
 • ConsoleUI provides: status bar, message composer, log output
 • API endpoints mirror BotManager functionality


                                                    State Management

 • Bot state (current channel, thread, status) maintained in CommandHandler
 • Logs stored in BotManager with max capacity of 50 entries
 • Server instance tracked globally


                                                 Important Constraints

 • Rate limiting handled for Discord API
 • Environment variables required: DISCORD_TOKEN, API_PORT, API_HOST
 • Web UI connects via socket.io


                                                   Command Structure

 • Commands start with "/" (e.g., /help, /status, /channel)
 • Command arguments are space-separated
 • Some commands trigger interactive prompts (e.g., channel selection)


                                                     Error Handling

 • BotManager logs errors and emits events
 • CommandHandler displays errors to the user via ConsoleUI
 • Rate limiting is handled automatically with backoff


                                                  Discord Integration

 • Uses Discord.js library for API interactions
 • Supports slash commands registration via REST API
 • Handles channel types: text, forum, and threads


                                                     Logging System

 • Console logs stored in memory and file (console.log)
 • Timestamps in ISO format
 • Log rotation implemented with max capacity


                                                   For AI Assistants

 • Always check existing methods before suggesting new ones
 • BotManager is an EventEmitter - use emit/on pattern for new events
 • Server state is managed through startServer/stopServer methods
 • UI rendering happens through ConsoleUI.render() after state changes
 • Message composition and sending are separate operations
