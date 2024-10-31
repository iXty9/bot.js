const readline = require('readline');
const chalk = require('chalk');
const boxen = require('boxen');

class ConsoleUI {
  /**
   * Initializes an instance of ConsoleUI.
   * @param {readline.Interface} rl - The readline interface for I/O.
   */
  constructor(rl) {
    this.rl = rl;
    this.logs = [];
    this.statusBar = '';
    this.composer = '';
  }

  /**
   * Updates the status bar with new information.
   * @param {string} status - The new status to display.
   */
  updateStatusBar(status) {
    this.statusBar = status;
    this.render();
  }

  /**
   * Updates the composer area with new text.
   * @param {string} text - The new text for the composer.
   */
  updateComposer(text) {
    this.composer = text;
    this.render();
  }

  /**
   * Adds a new log message to the console.
   * @param {string} message - The message to log.
   */
  addLog(message) {
    this.logs.push(message);
    if (this.logs.length > 10) {
      this.logs.shift();
    }
    this.render();
  }

  /**
   * Renders the entire console UI.
   */
  render() {
    console.clear();
    
    // Status Bar
    console.log(chalk.bgBlue.white.bold(` ${this.statusBar} `));
    
    // Logs
    const logBox = boxen(this.logs.join('\n'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      title: chalk.yellow('Logs'),
      titleAlignment: 'center'
    });
    console.log(logBox);
    
    // Composer
    const composerBox = boxen(this.composer || 'Type your message here...', {
      padding: 1,
      margin: 1,
      borderStyle: 'bold',
      borderColor: 'green',
      title: chalk.yellow('Composer'),
      titleAlignment: 'center'
    });
    console.log(composerBox);
    
    // Command prompt
    console.log(chalk.cyan('Enter a command or message:'));
    this.rl.prompt();
  }

  /**
   * Prompts the user for input and handles the response.
   * @param {Function} callback - The function to call with user input.
   */
  promptUser(callback) {
    this.rl.question(chalk.green('> '), (input) => {
      callback(input);
      this.promptUser(callback);
    });

    // Handle Ctrl+S to send the message
    process.stdin.on('keypress', (str, key) => {
      if (key.ctrl && key.name === 's') {
        callback('/send');
      }
    });
  }
}

module.exports = ConsoleUI;