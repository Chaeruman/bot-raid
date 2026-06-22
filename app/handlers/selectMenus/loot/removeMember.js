const { saveState, clearPendingEphemeral } = require("../../../state");
const { refreshLootPanel } = require("../../../builders/lootPanel");

async function handleRemoveMemberSelect(interaction, panel) {
  const userId = interaction.values[0];

  panel.members = panel.members.filter((id) => id !== userId);
  delete panel.payments[userId];
  saveState();

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
  clearPendingEphemeral(panel.lootMsgId, interaction.user.id);
}

module.exports = { handleRemoveMemberSelect };
