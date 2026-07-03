const { handleStart }   = require("./start");
const { handleRaid }    = require("./raid");
const { handleMarathon } = require("./marathon");
const { handleLoot }    = require("./loot");
const { handleState }   = require("./state");
const { handleClear }   = require("./clear");
const { handleLootAction } = require("./lootAction");
const { handleCombinedPay } = require("./combinedPay");
const { handleMySalary } = require("./mySalary");
const { handleDigestNow } = require("./digestNow");
const { handleLz } = require("./lz");
const { handleLzNow } = require("./lzNow");

const commandHandlers = {
  start:    handleStart,
  raid:     handleRaid,
  marathon: handleMarathon,
  loot:     handleLoot,
  state:    handleState,
  clear:    handleClear,
  "loot-action": handleLootAction,
  "kirim-gaji": handleCombinedPay,
  "gaji-saya": handleMySalary,
  "digest-now": handleDigestNow,
  lz: handleLz,
  "lz-now": handleLzNow,
};

async function handleCommand(interaction) {
  const handler = commandHandlers[interaction.commandName];
  if (handler) await handler(interaction);
}

module.exports = { handleCommand };
