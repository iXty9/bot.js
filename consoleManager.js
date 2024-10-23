let webhookLogs = [];
const maxWebhookLogs = 10;

function updateConsole() {
  console.clear();

  const availableLines = process.stdout.rows - 3;

  let flatLogs = webhookLogs.flatMap(log => log.split('\n'));

  while (flatLogs.length > availableLines) {
    flatLogs.shift();
  }

  flatLogs.forEach(log => console.log(log));
  
  const emptyLines = availableLines - flatLogs.length;
  for (let i = 0; i < emptyLines; i++) {
    console.log();
  }

  const statusBarContent = `Discord Bot | ${new Date().toLocaleString()}`;
  const padding = process.stdout.columns - statusBarContent.length - 4;
  const statusBar = `--[${statusBarContent}]${'-'.repeat(Math.max(padding, 0))}--`;
  console.log(statusBar.slice(0, process.stdout.columns));
}

function addWebhookLog(log) {
  webhookLogs.push(log);
  if (webhookLogs.length > maxWebhookLogs) {
    webhookLogs.shift();
  }
}

module.exports = { updateConsole, addWebhookLog };
