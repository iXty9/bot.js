// Load environment variables from the .env file.
require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js'); // Import necessary classes/constants from discord.js.
const readline = require('readline'); // Import readline module to handle user input from the terminal.
const BotManager = require('./src/BotManager'); // Import the custom BotManager class.
const ConsoleUI = require('./src/ConsoleUI'); // Import the custom ConsoleUI class.
const CommandHandler = require('./src/CommandHandler'); // Import the custom CommandHandler class.

// Create a new Discord.js client instance, defining the required intents for the bot to operate.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Intent to receive guild (server) related events (e.g., joining/leaving servers).
    GatewayIntentBits.GuildMessages, // Intent to receive and handle message events.
    GatewayIntentBits.MessageContent // Intent to read message contents (only necessary with certain restrictions).
  ]
});

// Create a readline interface to capture input/output from the command line.
const rl = readline.createInterface({
  input: process.stdin, // Input will come from the terminal (stdin).
  output: process.stdout // Output (prompts, etc.) will be displayed to the terminal (stdout).
});

// Create an instance of BotManager, passing the client and the Discord webhook URL.
const botManager = new BotManager(client, process.env.WEBHOOK_URL);

// Create an instance of ConsoleUI, responsible for UI and log management.
const consoleUI = new ConsoleUI(rl, client);

// Create an instance of CommandHandler to manage user commands and messages.
const commandHandler = new CommandHandler(client, botManager, consoleUI);

// Event listener for when the client successfully logs in and has loaded.
client.once('ready', () => {
  // Log the bot's login confirmation.
  consoleUI.addLog(`Logged in as ${client.user.tag}!`); // Logs "Logged in as <BotUsername>#<BotTag>!"
  consoleUI.addLog('Type "/help" for a list of commands.'); // Prompts the user about how to access the help menu.
  
  consoleUI.updateConsole(); // Refresh the console display with the current logs and status.
  
  // Begin prompting the user for commands from the terminal, using the CommandHandler.
  consoleUI.promptUser(commandHandler.handleInput.bind(commandHandler)); // Ensure proper context is passed to handleInput.
});

// Event listener for when a new message is created in one of the guilds (servers) this bot has access to.
client.on('messageCreate', async (message) => {
  // Ignore messages from bots to prevent infinite loops and unnecessary webhook calls.
  if (message.author.bot) return;

  // Handle the incoming message via the BotManager (e.g., format and send to webhook).
  await botManager.handleIncomingMessage(message);
  
  consoleUI.updateConsole(); // Update the console display to reflect that a new message was processed.
});

// Log the bot into Discord using the token from the environment variables.
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  // Failure case: Log the error and terminate the program with a non-success exit code.
  console.error('Failed to log in:', error); // Show a detailed log of why the login failed.
  process.exit(1); // Exit the process with status code 1 to indicate an error.
});

// Handle any unhandled promise rejections globally (e.g., failures not caught elsewhere).
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error); // Log the error.
});
