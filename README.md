# Discord Bot Manager

 ![Discord Bot Manager](https://img.shields.io/badge/Discord-Bot%20Manager-blue.svg)

 ## Overview

 Discord Bot Manager is a comprehensive tool designed to manage and interact with your Discord bot through an
 intuitive web interface. It provides features for configuring bot settings, managing commands, viewing logs, an
 more, all from a centralized dashboard.

 ## Features

 - **Web Interface**: Manage your bot with ease using a user-friendly web GUI.
 - **Command Management**: Add, edit, and remove slash commands directly from the interface.
 - **Configuration Settings**: Easily update and manage environment variables and bot settings.
 - **Real-time Logs**: View and refresh logs to monitor bot activity in real-time.
 - **Status Management**: Change the bot's status (online, idle, dnd, invisible) with a simple click.
 - **Message Management**: Send, edit, and delete messages in Discord channels.

 ## Getting Started

 ### Prerequisites

 - **Node.js**: Ensure you have Node.js installed on your machine.
 - **npm**: Node Package Manager is required to install dependencies.

 ### Installation

 1. **Clone the Repository**:
    ```bash
    git clone https://github.com/yourusername/discord-bot-manager.git
    cd discord-bot-manager


 2 Install Dependencies:

    npm install

 3 Set Up Environment Variables:
    • Copy .env.example to .env and fill in the required values:

       API_PORT=6987
       API_HOST=0.0.0.0
       DISCORD_TOKEN=your-discord-bot-token-here
       JWT_SECRET=your-secret-here
       WEBHOOK_URL=your-webhook-url-here

 4 Build the Project:

    npm run build

 5 Start the Application:

    npm start
