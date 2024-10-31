const readline = require('readline');

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
    console.log(this.statusBar);
    console.log('-'.repeat(process.stdout.columns));
    this.logs.forEach(log => console.log(log));
    console.log('-'.repeat(process.stdout.columns));
    console.log('Composer:');
    console.log(this.composer);
    console.log('-'.repeat(process.stdout.columns));
    this.rl.prompt();
  }

  /**
   * Prompts the user for input and handles the response.
   * @param {Function} callback - The function to call with user input.
   */
  promptUser(callback) {
    this.rl.question('> ', (input) => {
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