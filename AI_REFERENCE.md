# AI Development Reference

 ## Project Overview
 Discord bot with console UI and web interface. Manages Discord interactions, provides command handling, and exposes
 functionality through an API server.

 ## Core Components
 - BotManager: Central controller for Discord interactions
 - CommandHandler: Processes user commands from console
 - ConsoleUI: Terminal-based interface
 - API Server: Web interface for remote control

 ## Architecture Patterns
 - Event-driven communication between components
 - Command pattern for handling user inputs
 - Singleton pattern for BotManager instance

 ## Key Interfaces
 - BotManager exposes methods for: sending messages, changing status, listing channels
 - ConsoleUI provides: status bar, message composer, log output
 - API endpoints mirror BotManager functionality

 ## State Management
 - Bot state (current channel, thread, status) maintained in CommandHandler
 - Logs stored in BotManager with max capacity of 50 entries
 - Server instance tracked globally

 ## Important Constraints
 - Rate limiting handled for Discord API
 - Environment variables required: DISCORD_TOKEN, API_PORT, API_HOST
 - Web UI connects via socket.io
