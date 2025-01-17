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

rl.on('SIGINT', () => {
  rl.question('Are you sure you want to exit? (y/n) ', (answer) => {
    if (answer.match(/^y(es)?$/i)) {
      rl.close();
      process.exit(0);
    }
  });
});

// Initialize bot components.
const botManager = new BotManager(client, process.env.WEBHOOK_URL);
await initializeBotManager(client); // Initialize the API server's BotManager instance
const consoleUI = new ConsoleUI(rl);
const commandHandler = new CommandHandler(client, botManager, consoleUI);

// Ensure bot manager is initialized
if (!botManager) {
  console.error('Failed to initialize bot manager');
  process.exit(1);
}

// Define slash commands
const commands = [
  {
    name: 'fact',
    description: 'Get a random fact',
  },
  {
    name: 'status',
    description: 'Change bot status',
    options: [{
      name: 'newstatus',
      description: 'New status to set (online, idle, dnd, invisible)',
      type: 3,
      required: true,
      choices: [
        { name: 'Online', value: 'online' },
        { name: 'Idle', value: 'idle' },
        { name: 'Do Not Disturb', value: 'dnd' },
        { name: 'Invisible', value: 'invisible' }
      ]
    }]
  },
  {
    name: 'help',
    description: 'Show available commands and their usage'
  }
];


// Event listener for when the client is ready.
client.once('ready', async () => {
  consoleUI.addLog(`Logged in as ${client.user.tag}!`);
  consoleUI.addLog('Type "/help" for a list of commands.');
  
  // Register slash commands first
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    consoleUI.addLog('Started refreshing application (/) commands.');
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    
    consoleUI.addLog('Successfully reloaded application (/) commands:');
    commands.forEach(cmd => {
      consoleUI.addLog(`- /${cmd.name}`);
    });
  } catch (error) {
    consoleUI.addLog(`Failed to register commands: ${error.message}`);
  }
  
  await commandHandler.initialize(); // Initialize the current channel
  
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

  try {
    switch (interaction.commandName) {
      case 'fact':
        await commandHandler.handleFactCommand(interaction);
        break;
      case 'status':
        await commandHandler.handleStatusCommand(interaction);
        break;
      case 'help':
        await commandHandler.handleHelpCommand(interaction);
        break;
      default:
        await interaction.reply({ content: 'Unknown command', ephemeral: true });
    }
  } catch (error) {
    console.error('Error handling slash command:', error);
    await interaction.reply({ 
      content: 'An error occurred while processing the command', 
      ephemeral: true 
    }).catch(console.error);
  }
});


if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is not set in the environment variables.');
  process.exit(1);
}

if (!process.env.API_PORT || !process.env.API_HOST) {
  console.error('API_PORT or API_HOST is not set in the environment variables.');
  process.exit(1);
}

// Log in to Discord.
client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('Failed to log in:', error);
  console.log('Please check your DISCORD_TOKEN in the environment variables.');
  process.exit(1);
});

// Handle unhandled promise rejections.
const unhandledRejectionHandler = (error) => {
  console.error('Unhandled promise rejection:', error);
};
process.on('unhandledRejection', unhandledRejectionHandler);

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('Cleaning up...');
  process.removeListener('unhandledRejection', unhandledRejectionHandler);
  if (client) {
    await client.destroy();
  }
  process.exit(0);
});

// Log the current working directory
console.log('Current working directory:', process.cwd());

// Start the server
const PORT = process.env.API_PORT || 6987;
const HOST = process.env.API_HOST || '0.0.0.0';

console.log(`Configured API server to run on http://${HOST}:${PORT}`);

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
        resolve(server);
      });

      // Graceful shutdown
      const shutdown = async () => {
        console.log('Shutdown signal received');
        try {
          if (server) {
            await new Promise(resolve => server.close(resolve));
            console.log('HTTP server closed');
          }
          if (client) {
            await client.destroy();
            console.log('Discord client destroyed');
          }
        } catch (error) {
          console.error('Error during shutdown:', error);
        } finally {
          console.log('Exiting process...');
          process.exit(0);
        }
      };

      const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'];
      signals.forEach(signal => {
        process.on(signal, shutdown);
      });

    } catch (error) {
      console.error('Critical server error:', error);
      reject(error);
    }
  });
};

// Start the server and handle any errors
startServer().catch(error => {
  console.error('Failed to start server:', error);
  console.log('Ensure that the API_PORT and API_HOST are correctly configured.');
  console.log('Ensure that the API_PORT and API_HOST are correctly configured.');
  process.exit(1);
});
