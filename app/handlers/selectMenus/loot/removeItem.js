const { MessageFlags } = require("discord.js");
const { saveState, clearPendingEphemeral } = require("../../../state");
const { refreshLootPanel } = require("../../../builders/lootPanel");

async function handleRemoveItemSelect(interaction, panel) {
  const idx = parseInt(interaction.values[0], 10);
  if (!panel.items[idx]) {
    return interaction.reply({ content: "❌ Item not found.", flags: MessageFlags.Ephemeral });
  }

  panel.items.splice(idx, 1);
  saveState();

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
  clearPendingEphemeral(panel.lootMsgId, interaction.user.id);
}

module.exports = { handleRemoveItemSelect };
