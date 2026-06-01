const { refreshLootPanel } = require("../../../builders/lootPanel");

async function handleMarkPaidSelect(interaction, panel) {
  const targetId = interaction.values[0];
  panel.payments[targetId] = !panel.payments[targetId];

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleMarkPaidSelect };
