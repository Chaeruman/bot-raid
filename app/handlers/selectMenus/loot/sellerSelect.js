const { refreshLootPanel } = require("../../../builders/lootPanel");
const { saveState, clearPendingEphemeral } = require("../../../state");

async function handleSellerSelect(interaction, panel) {
  const selectedId = interaction.values[0];
  panel.sellerId = selectedId;
  saveState();

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
  clearPendingEphemeral(panel.lootMsgId, interaction.user.id);
}

module.exports = { handleSellerSelect };
