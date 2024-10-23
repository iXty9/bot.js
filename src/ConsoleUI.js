class ConsoleUI {
  /**
   * Constructs the ConsoleUI instance.
   * @param {Object} readline - The `readline` interface used for handling user input.
   * @param {Object} client - The bot client instance, which provides information like username or status.
   */
  constructor(readline, client) {
    this.rl = readline; // The readline interface to capture user input from the console.
    this.client = client; // The Discord bot's client object used to retrieve user details and status.
    this.logs = []; // An array to store log messages for displaying in the console.
    this.maxLogs = 10; // The maximum number of logs to keep in the log buffer.
  }

  /**
   * Adds a log message to the log buffer, ensuring it doesn't exceed `maxLogs`.
   * If the log buffer exceeds the limit, the oldest log is removed (FIFO).
   * @param {string} log - The log message to be added.
   */
  addLog(log) {
    this.logs.push(log); // Pushes new log into the logs array.

    // Check if we have exceeded the maximum log count, if yes, remove the oldest entry.
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove the first (oldest) log entry.
    }
  }

  /**
   * Refreshes the console display by clearing it and printing all logs followed by a status bar.
   * Ensures that only the most recent logs stay visible within the available window height.
   */
  updateConsole() {
    console.clear(); // Clears the current console content.

    // Compute how many lines are available on the screen, excluding the reserved lines for status bar and prompt.
    const availableLines = process.stdout.rows - 3;

    // Split multiline logs and flatten them into a single array for better display.
    let flatLogs = this.logs.flatMap(log => log.split('\n'));

    // Adjust the number of logs to fit within available console lines, removing oldest entries if needed.
    while (flatLogs.length > availableLines) {
      flatLogs.shift(); // Remove the oldest log line if display limit is exceeded.
    }

    // Print each log entry in the console.
    flatLogs.forEach(log => console.log(log));
    
    // Fill remaining space with empty lines to maintain a clean console appearance.
    const emptyLines = availableLines - flatLogs.length;
    for (let i = 0; i < emptyLines; i++) {
      console.log(); // Print extra new lines to consume the remaining space.
    }

    // Print the status bar to display bot information (e.g., username and status).
    this.printStatusBar();
    
    // Restore the prompt without starting a new line.
    // `rl.prompt(true)` redraws the prompt without erasing existing input.
    this.rl.prompt(true);
  }

  /**
   * Prints the status bar at the bottom of the console, showing the bot's username and status.
   */
  printStatusBar() {
    // Extract username and status from the bot client, or provide fallbacks if unavailable.
    const userName = this.client.user ? this.client.user.username : 'Not logged in';
    const status = this.client.user ? this.client.user.presence.status : 'offline';

    // Build the status bar content (e.g., "<username> | <status>").
    const statusBarContent = `${userName} | ${status}`;

    // Calculate the remaining space on the console line after displaying the status content.
    const padding = process.stdout.columns - statusBarContent.length - 4;

    // Create the status bar with appropriate padding or truncation as needed.
    const statusBar = `--[${statusBarContent}]${'-'.repeat(Math.max(padding, 0))}--`;

    // Slice the status bar if necessary to ensure it doesn't exceed the console width.
    console.log(statusBar.slice(0, process.stdout.columns));
  }

  /**
   * Prompts the user for input using the readline interface and processes it with the provided callback.
   * Continually re-prompts the user after input and refreshes the console display.
   * @param {Function} callback - The function to handle user input commands or messages.
   */
  promptUser(callback) {
    // Ask the user for input. This starts the interactive user input process.
    this.rl.question('Enter a command or message (type "/help" for options): ', async (input) => {
      
      this.updateConsole(); // Refresh the console after input to show logs and UI elements.
      
      // Process user input using the provided callback (typically a command handler or bot manager).
      await callback(input);
      
      this.updateConsole(); // Refresh console display again after processing user input.

      // Continue prompting for additional user input (recursive loop).
      this.promptUser(callback);
    });
  }
}

module.exports = ConsoleUI;
