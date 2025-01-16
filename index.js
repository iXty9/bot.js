// Load environment variables from the .env file.
require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { initializeBotManager, app } = require('./src/api/server');
const readline = require('readline');
const BotManager = require('./src/BotManager');
const ConsoleUI = require('./src/ConsoleUI');
const CommandHandler = require('./src/CommandHandler');

// Create a new Discord.js client instance with required intents.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Create a readline interface for command-line I/O.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize bot components.
const botManager = new BotManager(client, process.env.WEBHOOK_URL);
initializeBotManager(client); // Initialize the API server's BotManager instance
const consoleUI = new ConsoleUI(rl);
const commandHandler = new CommandHandler(client, botManager, consoleUI);

// Define slash commands
const commands = [
  {
    name: 'fact',
    description: 'Get a random fact',
  },
  // Add more slash commands here as needed
];

// Function to register slash commands
async function registerSlashCommands() {
  try {
    console.log('Started refreshing application (/) commands.');

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
}

// Event listener for when the client is ready.
client.once('ready', async () => {
  consoleUI.addLog(`Logged in as ${client.user.tag}!`);
  consoleUI.addLog('Type "/help" for a list of commands.');
  
  await commandHandler.initialize(); // Initialize the current channel
  await registerSlashCommands(); // Register slash commands
  
  const serverStatus = await botManager.checkServerStatus();
  consoleUI.addLog(`Web server status: ${serverStatus}`);
  consoleUI.promptUser(commandHandler.handleInput.bind(commandHandler));
});

// Event listener for new messages.
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Ignore messages from bots
  await botManager.handleIncomingMessage(message);
  consoleUI.updateStatusBar(commandHandler.getStatusBarContent());
});

// Event listener for slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'fact') {
    await commandHandler.handleFactCommand(interaction);
  }
  // Add more command handlers here as needed
});

// Log in to Discord.
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('Failed to log in:', error);
  process.exit(1);
});

// Handle unhandled promise rejections.
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Log the current working directory
console.log('Current working directory:', process.cwd());

// Start the server
const PORT = process.env.API_PORT || 6987;
const HOST = process.env.API_HOST || '0.0.0.0';

let server;
const startServer = () => {
  return new Promise((resolve, reject) => {
    try {
      server = app.listen(PORT, HOST, (error) => {
        if (error) {
          console.error('Failed to start server:', error);
          reject(error);
          return;
        }
        console.log(`API server successfully running on http://${HOST}:${PORT}`);
        console.log('Server is now listening for incoming connections...');
        resolve(server);
      });

      // Graceful shutdown
      const shutdown = async () => {
        console.log('Shutdown signal received');
        if (server) {
          await new Promise(resolve => server.close(resolve));
          console.log('HTTP server closed');
        }
        if (client) {
          await client.destroy();
          console.log('Discord client destroyed');
        }
        process.exit(0);
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
      process.on('SIGHUP', shutdown);

    } catch (error) {
      console.error('Critical server error:', error);
      reject(error);
    }
  });
};

// Start the server and handle any errors
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
