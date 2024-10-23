const axios = require('axios');

class CommandHandler {
  /**
   * Initializes an instance of CommandHandler.
   * @param {Object} client - The bot client instance.
   * @param {Object} botManager - Manages bot functionalities (messages, status, and channels).
   * @param {Object} consoleUI - Provides a way to interact with the UI (logs, etc.).
   */
  constructor(client, botManager, consoleUI) {
    this.client = client; // The bot client object.
    this.botManager = botManager; // Allows communication with the bot management system.
    this.consoleUI = consoleUI; // The UI interface used for logging and visibility in the console.
  }

  /**
   * Processes and handles the input from the user.
   * If the input starts with '/', it is treated as a command.
   * Otherwise, it is treated as a message to be sent to the default channel.
   * @param {string} input - The raw input from the user.
   */
  async handleInput(input) {
    if (input.startsWith('/')) {
      // If input starts with '/', treat it as a command (split into command and arguments).
      const [command, ...args] = input.slice(1).split(' ');
      await this.handleCommand(command.toLowerCase(), args); // Handle the parsed command.
    } else {
      // If the input is not a command, attempt to send it as a message.
      await this.sendMessage(input);
    }
  }

  /**
   * Executes the appropriate actions based on a command.
   * @param {string} command - Command to be executed.
   * @param {Array<string>} args - Arguments provided with the command.
   */
  async handleCommand(command, args) {
    switch(command) {
      case 'help':
        this.showHelp(); // Show the list of available commands.
        break;
      
      case 'status':
        await this.changeStatus(args[0]); // Change the bot's status (first argument).
        break;
      
      case 'fact':
        await this.getRandomFact(); // Fetch and log a random fact.
        break;
      
      case 'send':
        // Send a message to a specific channel. First arg = channel, rest = message.
        await this.sendMessage(args.slice(1).join(' '), args[0]);
        break;
      
      case 'list':
        this.listChannels(); // List all available channels the bot is connected to.
        break;
      
      case 'exit':
        this.consoleUI.addLog('Exiting...'); // Log that the system is exiting.
        process.exit(0); // Terminate the application.
        break;
      
      default:
        // Handle unknown commands.
        this.consoleUI.addLog('Unknown command. Type "/help" for a list of commands.');
    }
  }

  /**
   * Displays a help message with a list of available commands.
   */
  showHelp() {
    const helpText = [
      'Available commands:',
      '  /help               - Show this help message',
      '  /status <newStatus> - Change bot status (online, idle, dnd, invisible)',
      '  /fact               - Get a random fact',
      '  /send <channel> <message> - Send a message to a specific channel',
      '  /list               - List all available channels',
      '  /exit               - Exit the program',
      '  <message>           - Send a message to the default (general) channel'
    ];

    // Add the help message to the console log line by line.
    helpText.forEach(line => this.consoleUI.addLog(line));
  }

  /**
   * Changes the bot's status (e.g., online, idle, dnd, invisible).
   * @param {string} newStatus - The new desired status.
   */
  async changeStatus(newStatus) {
    try {
      // Delegate the status change to the BotManager and log the result.
      const result = await this.botManager.changeStatus(newStatus);
      this.consoleUI.addLog(result);
    } catch (error) {
      // Log any errors that occur during the status change.
      this.consoleUI.addLog('Error changing status: ' + error);
    }
  }

  /**
   * Sends a message to a specific channel.
   * @param {string} message - The message text to send.
   * @param {string} [channelName='general'] - The channel name to send the message to (defaults to 'general').
   */
  async sendMessage(message, channelName = 'general') {
    try {
      // Send the message to the specified channel via BotManager and log the result.
      const result = await this.botManager.sendMessage(message, channelName);
      this.consoleUI.addLog(result);
    } catch (error) {
      // Log any errors encountered while sending the message.
      this.consoleUI.addLog('Error sending message: ' + error);
    }
  }

  /**
   * Fetches a random fact from an external API and sends it to the default channel.
   */
  async getRandomFact() {
    try {
      // Fetch a random fact from an external API.
      const response = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en');
      const fact = response.data.text; // Extract fact from API response.

      // Log the random fact to the console and send it to the default (general) channel.
      this.consoleUI.addLog('Random Fact: ' + fact);
      await this.sendMessage(`Here's a random fact: ${fact}`);
    } catch (error) {
      // Log any errors encountered during the fact fetching.
      this.consoleUI.addLog('Error fetching random fact: ' + error);
    }
  }

  /**
   * Lists all available text channels the bot is connected to in a formatted style.
   */
  listChannels() {
    // Get the list of text channel names from BotManager.
    const channels = this.botManager.listChannels();

    // Calculate width by finding the longest channel name plus some padding.
    const columnWidth = Math.max(...channels.map(ch => ch.length)) + 2;
    
    // Calculate the number of columns that will fit within the current console width.
    const columnsPerRow = Math.floor(process.stdout.columns / columnWidth);
    
    let output = 'Available channels:\n';

    // Print channels distributed into rows/columns to ensure they fit neatly.
    for (let i = 0; i < channels.length; i += columnsPerRow) {
      const row = channels.slice(i, i + columnsPerRow);
      output += row.map(ch => ch.padEnd(columnWidth)).join('') + '\n'; // Create columns using padded channel names.
    }
    
    // Trim and add the final formatted output to the console log.
    this.consoleUI.addLog(output.trim());
  }
}

module.exports = CommandHandler;
