require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const readline = require('readline');
const BotManager = require('./src/BotManager');
const ConsoleUI = require('./src/ConsoleUI');
const CommandHandler = require('./src/CommandHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const botManager = new BotManager(client, process.env.WEBHOOK_URL);
const consoleUI = new ConsoleUI(rl, client);
const commandHandler = new CommandHandler(client, botManager, consoleUI);

client.once('ready', () => {
  consoleUI.addLog(`Logged in as ${client.user.tag}!`);
  consoleUI.addLog('Type "/help" for a list of commands.');
  consoleUI.updateConsole();
  consoleUI.promptUser(commandHandler.handleInput.bind(commandHandler));
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  await botManager.handleIncomingMessage(message);
  consoleUI.updateConsole();
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('Failed to log in:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});