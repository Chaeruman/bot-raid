const { refreshLootPanel } = require("../../../builders/lootPanel");
const { activeLootPanels, saveState, clearPendingEphemeral } = require("../../../state");

async function handleMarkPaidSelect(interaction, panel) {
  const targetId = interaction.values[0];
  panel.payments[targetId] = !panel.payments[targetId];

  // Auto-close once everyone has been paid
  const allPaid = panel.members.length > 0 && panel.members.every((uid) => panel.payments[uid]);
  if (allPaid) panel.closed = true;

  saveState();

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
  clearPendingEphemeral(panel.lootMsgId, interaction.user.id);

  if (allPaid) {
    delete activeLootPanels[panel.lootMsgId];
    saveState();
  }
}

module.exports = { handleMarkPaidSelect };
