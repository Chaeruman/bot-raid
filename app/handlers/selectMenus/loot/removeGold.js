const { MessageFlags } = require("discord.js");
const { saveState, clearPendingEphemeral } = require("../../../state");
const { refreshLootPanel } = require("../../../builders/lootPanel");

async function handleRemoveGoldSelect(interaction, panel) {
  const idx = parseInt(interaction.values[0], 10);
  if (!panel.goldEntries[idx]) {
    return interaction.reply({ content: "❌ Gold drop not found.", flags: MessageFlags.Ephemeral });
  }

  panel.goldEntries.splice(idx, 1);
  saveState();

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
  clearPendingEphemeral(panel.lootMsgId, interaction.user.id);
}

module.exports = { handleRemoveGoldSelect };
