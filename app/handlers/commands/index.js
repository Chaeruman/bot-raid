const { handleStart }   = require("./start");
const { handleRaid }    = require("./raid");
const { handleMarathon } = require("./marathon");
const { handleLoot }    = require("./loot");

const commandHandlers = {
  start:    handleStart,
  raid:     handleRaid,
  marathon: handleMarathon,
  loot:     handleLoot,
};

async function handleCommand(interaction) {
  const handler = commandHandlers[interaction.commandName];
  if (handler) await handler(interaction);
}

module.exports = { handleCommand };
