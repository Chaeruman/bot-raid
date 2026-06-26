const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const { CATALOG } = require("../../../items");

// Kept for compatibility with the (now-orphaned) select price flow.
function buildSetPriceRow(panel) {
  const options = panel.items.map((item, idx) => {
    const def = CATALOG[item.itemKey];
    const detailStr = item.detail ? ` (${item.detail})` : "";
    const priceStr = item.price != null ? ` — ${item.price.toLocaleString()}g` : " — no price";
    return {
      label: `${def.name}${detailStr}`.slice(0, 100),
      value: String(idx),
      description: `${item.qty}x${priceStr}`.slice(0, 100),
    };
  });

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:price_item:${panel.lootMsgId}`)
      .setPlaceholder("Select item to set price")
      .addOptions(options),
  );
}

// One numbered line per item, price goes in the trailing ().
function buildPricePrefill(panel) {
  return panel.items
    .map((item, i) => {
      const def = CATALOG[item.itemKey];
      const detail = item.detail ? ` (${item.detail})` : "";
      const cur = item.price != null ? item.price : "";
      return `${i + 1}) ${def.name}${detail} x${item.qty} = (${cur})`;
    })
    .join("\n")
    .slice(0, 4000);
}

async function handleSetPrice(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can set prices.", flags: MessageFlags.Ephemeral });
  }

  if (panel.items.length === 0) {
    return interaction.reply({ content: "❌ No items added yet.", flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:set_prices:${panel.lootMsgId}`)
    .setTitle("Set Item Prices");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("prices")
        .setLabel("Fill the (brackets) — e.g. (50000g)")
        .setStyle(TextInputStyle.Paragraph)
        .setValue(buildPricePrefill(panel))
        .setRequired(false),
    ),
  );

  return interaction.showModal(modal);
}

// Per-item pricing — pick one item from the dropdown, then a modal (price + note).
async function handleSetPriceOne(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can set prices.", flags: MessageFlags.Ephemeral });
  }
  if (panel.items.length === 0) {
    return interaction.reply({ content: "❌ No items added yet.", flags: MessageFlags.Ephemeral });
  }

  return interaction.reply({
    content: "🏷️ **Price Item** — select item:",
    components: [buildSetPriceRow(panel)],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleSetPrice, handleSetPriceOne, buildSetPriceRow };
