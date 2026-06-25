const { MessageFlags } = require("discord.js");
const { activeLootPanels, saveState } = require("../../state");
const { refreshLootPanel } = require("../../builders/lootPanel");
const { buildSetPriceRow } = require("../buttons/loot/setPrice");

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

  const item = panel.items[idx];
  if (!item) {
    return interaction.reply({ content: "❌ Item not found in loot list.", flags: MessageFlags.Ephemeral });
  }

  item.price = price;
  const note = interaction.fields.getTextInputValue("note").trim();
  item.note = note || null;
  saveState();

  // Keep the picker open for the next price; clear once every item has a price.
  const allPriced = panel.items.every((i) => i.price != null);
  if (allPriced) {
    await interaction.update({ content: "✅ All items priced.", components: [] });
  } else {
    await interaction.update({ content: "🏷️ **Set Price** — select item:", components: [buildSetPriceRow(panel)] });
  }
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleItemPriceModal };
