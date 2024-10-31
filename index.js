// Load environment variables from the .env file.
require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
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
const consoleUI = new ConsoleUI(rl);
const commandHandler = new CommandHandler(client, botManager, consoleUI);

// Event listener for when the client is ready.
client.once('ready', async () => {
  consoleUI.addLog(`Logged in as ${client.user.tag}!`);
  consoleUI.addLog('Type "/help" for a list of commands.');
  
  await commandHandler.initialize(); // Initialize the current channel
  
  consoleUI.promptUser(commandHandler.handleInput.bind(commandHandler));
});

// Event listener for new messages.
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Ignore messages from bots
  await botManager.handleIncomingMessage(message);
  consoleUI.updateStatusBar(commandHandler.getStatusBarContent());
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
