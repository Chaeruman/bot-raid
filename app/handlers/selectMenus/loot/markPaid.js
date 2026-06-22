const { refreshLootPanel } = require("../../../builders/lootPanel");
const { saveState, clearPendingEphemeral } = require("../../../state");

async function handleMarkPaidSelect(interaction, panel) {
  const targetId = interaction.values[0];
  panel.payments[targetId] = !panel.payments[targetId];
  saveState();

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
  clearPendingEphemeral(panel.lootMsgId, interaction.user.id);
}

module.exports = { handleMarkPaidSelect };
