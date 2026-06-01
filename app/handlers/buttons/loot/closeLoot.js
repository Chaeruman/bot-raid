const { MessageFlags } = require("discord.js");
const { activeLootPanels } = require("../../../state");
const { refreshLootPanel } = require("../../../builders/lootPanel");

async function handleCloseLoot(interaction, panel) {
  if (interaction.user.id !== panel.hostId) {
    return interaction.reply({ content: "⛔ Only the host can close the loot panel.", flags: MessageFlags.Ephemeral });
  }

  panel.closed = true;

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);

  delete activeLootPanels[panel.lootMsgId];
}

module.exports = { handleCloseLoot };
