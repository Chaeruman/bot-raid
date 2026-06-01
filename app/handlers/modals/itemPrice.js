const { MessageFlags } = require("discord.js");
const { activeLootPanels } = require("../../state");
const { refreshLootPanel } = require("../../builders/lootPanel");

async function handleItemPriceModal(interaction) {
  // customId: loot-modal:item_price:{lootMsgId}:{idx}
  const parts = interaction.customId.split(":");
  const lootMsgId = parts[2];
  const idx       = parseInt(parts[3], 10);

  const panel = activeLootPanels[lootMsgId];
  if (!panel || panel.closed) {
    return interaction.reply({ content: "❌ Loot panel not found.", flags: MessageFlags.Ephemeral });
  }

  const rawPrice = interaction.fields.getTextInputValue("price").trim().replace(/,/g, "");
  const price = parseInt(rawPrice, 10);
  if (isNaN(price) || price < 0) {
    return interaction.reply({ content: "❌ Invalid price. Enter a non-negative number.", flags: MessageFlags.Ephemeral });
  }

  const allItems = [...panel.raidItems, ...panel.mailItems];
  const item = allItems[idx];
  if (!item) {
    return interaction.reply({ content: "❌ Item not found in loot list.", flags: MessageFlags.Ephemeral });
  }

  item.price = price;

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleItemPriceModal };
