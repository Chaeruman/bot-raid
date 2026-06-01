const { handleStart } = require("./start");

const commandHandlers = {
  start: handleStart,
};

async function handleCommand(interaction) {
  const handler = commandHandlers[interaction.commandName];
  if (handler) await handler(interaction);
}

module.exports = { handleCommand };
