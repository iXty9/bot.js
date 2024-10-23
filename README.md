# Discord Bot Manager

![License](https://img.shields.io/badge/license-MIT-blue) ![Node.js CI](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

A custom Discord bot aimed at easy management of Discord servers with a command-line interface (CLI). This bot allows you to handle server messages, interact with webhooks, change bot statuses, and more, all through terminal commands.

## Features

- **Webhook interaction**: Send incoming server messages to a webhook.
- **Console-based controls**: Input commands directly in your terminal to manage the bot.
- **Message Send**: Send messages to specific channels from your terminal.
- **Status Update**: Change the bot's online status (online, idle, dnd, invisible).
- **Random Facts**: Fetch and send random fun facts to the server.
- **Channel Listing**: Display all available text channels in the terminal.
  
## Prerequisites

- Node.js (v18+)
- Discord bot token from the [Discord Developer Portal](https://discord.com/developers/applications)
- A Discord webhook URL for handling message events.

## Installation

1. **Clone the repository:**

    ```bash
    git clone https://github.com/yourusername/discord-bot-manager.git
    cd discord-bot-manager
    ```

2. **Install dependencies:**
   
    Using `npm` to install:

    ```bash
    npm install
    ```

3. **Create a `.env` file:**

   Create a `.env` file in the root of your project and add your bot's credentials:

    ```bash
    DISCORD_TOKEN=your-discord-bot-token
    WEBHOOK_URL=your-discord-webhook-url
    ```

   - **DISCORD_TOKEN**: Your bot token found in the [Discord Developer Portal](https://discord.com/developers/applications).
   - **WEBHOOK_URL**: Your Discord webhook URL for handling message events.

4. **Run the project:**
   
   Start your Discord bot by running:

    ```bash
    npm start
    ```

## Usage

Once the bot is running, you can interact with it using your terminal for various commands:

### Terminal Commands

- **`/help`**: Displays a list of available commands.
- **`/status <newStatus>`**: Changes the bot's status. Options: `online`, `idle`, `dnd`, `invisible`.
- **`/fact`**: Fetches and sends a random fact to the default channel.
- **`/send <channel> <message>`**: Sends a message to the specified channel.
- **`/list`**: Lists all available text channels in the server.
- **`<message>`**: Sends the message to the default channel (usually `#general`).
- **`/exit`**: Shuts down the bot and closes the terminal session.

### Example Usage

```bash
Logged in as mycoolbot#1234!
Type "/help" for a list of commands.
Enter a command or message (type "/help" for options): 

/help
Available commands:
  /help               - Show this help message
  /status <newStatus> - Change bot status (online, idle, dnd, invisible)
  /fact               - Get a random fact
  /send <channel> <message> - Send a message to a specific channel
  /list               - List all available channels
  /exit               - Exit the program
  <message>           - Send a message to the default (general) channel
