const axios = require('axios');

class CommandHandler {
  /**
   * Initializes an instance of CommandHandler.
   * @param {Object} client - The bot client instance.
   * @param {Object} botManager - Manages bot functionalities (messages, status, and channels).
   * @param {Object} consoleUI - Provides a way to interact with the UI (logs, etc.).
   */
  constructor(client, botManager, consoleUI) {
    this.client = client;
    this.botManager = botManager;
    this.consoleUI = consoleUI;
    this.currentChannel = 'general';
    this.composingMessage = '';
  }

  /**
   * Initializes the CommandHandler by setting the default channel.
   */
  async initialize() {
    const channels = this.botManager.listChannels();
    this.currentChannel = channels.includes('general') ? 'general' : channels[0];
    this.updateStatusBar();
  }

  /**
   * Updates the status bar with current bot information.
   */
  updateStatusBar() {
    const status = this.client.user.presence.status;
    this.consoleUI.updateStatusBar(`${this.client.user.tag} | ${status} | Channel: ${this.currentChannel}`);
  }

  /**
   * Handles user input, either as a command or as message composition.
   * @param {string} input - User input from the console.
   */
  async handleInput(input) {
    if (input.startsWith('/')) {
      const [command, ...args] = input.slice(1).split(' ');
      await this.handleCommand(command.toLowerCase(), args);
    } else {
      this.composingMessage += input + '\n';
      this.consoleUI.updateComposer(this.composingMessage);
    }
  }

  /**
   * Handles various commands entered by the user.
   * @param {string} command - The command entered.
   * @param {Array<string>} args - Arguments for the command.
   */
  async handleCommand(command, args) {
    switch(command) {
      case 'help':
        this.showHelp();
        break;
      case 'status':
        await this.changeStatus(args[0]);
        break;
      case 'channel':
        await this.changeChannel(args[0]);
        break;
      case 'send':
        await this.sendComposedMessage();
        break;
      case 'clear':
        this.clearComposer();
        break;
      case 'list':
        this.listChannels();
        break;
      case 'exit':
        this.consoleUI.addLog('Exiting...');
        process.exit(0);
        break;
      default:
        this.consoleUI.addLog('Unknown command. Type "/help" for a list of commands.');
    }
  }

  /**
   * Displays help information about available commands.
   */
  showHelp() {
    const helpText = [
      'Available commands:',
      '  /help               - Show this help message',
      '  /status <newStatus> - Change bot status (online, idle, dnd, invisible)',
      '  /channel <name>     - Change the current channel',
      '  /send               - Send the composed message',
      '  /clear              - Clear the message composer',
      '  /list               - List all available channels',
      '  /exit               - Exit the program',
      'Compose your message by typing or pasting. Use Ctrl+S to send.'
    ];
    helpText.forEach(line => this.consoleUI.addLog(line));
  }

  /**
   * Changes the bot's status.
   * @param {string} newStatus - The new status to set.
   */
  async changeStatus(newStatus) {
    try {
      const result = await this.botManager.changeStatus(newStatus);
      this.consoleUI.addLog(result);
      this.updateStatusBar();
    } catch (error) {
      this.consoleUI.addLog('Error changing status: ' + error);
    }
  }

  /**
   * Changes the current active channel.
   * @param {string} channelName - The name of the channel to switch to.
   */
  async changeChannel(channelName) {
    const channels = this.botManager.listChannels();
    if (channels.includes(channelName)) {
      this.currentChannel = channelName;
      this.updateStatusBar();
      this.consoleUI.addLog(`Switched to channel: ${channelName}`);
    } else {
      this.consoleUI.addLog(`Channel "${channelName}" not found.`);
    }
  }

  /**
   * Sends the composed message to the current channel.
   */
  async sendComposedMessage() {
    if (this.composingMessage.trim() === '') {
      this.consoleUI.addLog('No message to send. Compose a message first.');
      return;
    }
    try {
      const result = await this.botManager.sendMessage(this.composingMessage.trim(), this.currentChannel);
      this.consoleUI.addLog(result);
      this.clearComposer();
    } catch (error) {
      this.consoleUI.addLog('Error sending message: ' + error);
    }
  }

  /**
   * Clears the message composition area.
   */
  clearComposer() {
    this.composingMessage = '';
    this.consoleUI.updateComposer('');
  }

  /**
   * Lists all available channels.
   */
  listChannels() {
    const channels = this.botManager.listChannels();
    const columnWidth = Math.max(...channels.map(ch => ch.length)) + 2;
    const columnsPerRow = Math.floor(process.stdout.columns / columnWidth);
    let output = 'Available channels:\n';
    for (let i = 0; i < channels.length; i += columnsPerRow) {
      const row = channels.slice(i, i + columnsPerRow);
      output += row.map(ch => ch.padEnd(columnWidth)).join('') + '\n';
    }
    this.consoleUI.addLog(output.trim());
  }
}

module.exports = CommandHandler;