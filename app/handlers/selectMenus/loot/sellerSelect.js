const { refreshLootPanel } = require("../../../builders/lootPanel");

async function handleSellerSelect(interaction, panel) {
  const selectedId = interaction.values[0];
  panel.sellerId = selectedId;

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleSellerSelect };
