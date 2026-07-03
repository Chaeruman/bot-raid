const { formatLzMessage } = require("../../data/luckyZone");

async function handleLz(interaction) {
  return interaction.reply(formatLzMessage());
}

module.exports = { handleLz };
