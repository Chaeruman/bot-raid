const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const { CATALOG } = require("../../../items");

// Used by the "Price One" flow. notForSale (gacha) items are excluded —
// nothing to price.
function buildSetPriceRow(panel) {
  const options = panel.items
    .map((item, idx) => {
      if (item.notForSale) return null;
      const def = CATALOG[item.itemKey];
      const detailStr = item.detail ? ` (${item.detail})` : "";
      const priceStr = item.price != null ? ` — ${item.price.toLocaleString()}g` : " — no price";
      return {
        label: `${def.name}${detailStr}`.slice(0, 100),
        value: String(idx),
        description: `${item.qty}x${priceStr}`.slice(0, 100),
      };
    })
    .filter(Boolean);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:price_item:${panel.lootMsgId}`)
      .setPlaceholder("Select item to set price")
      .addOptions(options),
  );
}

// One numbered line per sellable item; #note before "=", price after it
// (rightmost — "=" stays right next to the price so it's clear what to type
// there). notForSale (gacha) items are skipped — nothing to price — but the
// line numbers still match their real panel.items index, since the modal
// parser looks items up by that index.
function buildPricePrefill(panel) {
  return panel.items
    .map((item, i) => {
      if (item.notForSale) return null;
      const def = CATALOG[item.itemKey];
      const detail = item.detail ? ` (${item.detail})` : "";
      const note = item.note ? ` #${item.note}` : "";
      const cur = item.price != null ? item.price : "";
      return `${i + 1}. ${def.name}${detail} x${item.qty}${note} = ${cur}`;
    })
    .filter(Boolean)
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
  if (panel.items.every((i) => i.notForSale)) {
    return interaction.reply({ content: "🎁 Semua item di panel ini gacha — nggak ada yang perlu di-price.", flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:set_prices:${panel.lootMsgId}`)
    .setTitle("Set Item Prices");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("prices")
        .setLabel("#note before = · price after · math ok")
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
  if (panel.items.every((i) => i.notForSale)) {
    return interaction.reply({ content: "🎁 Semua item di panel ini gacha — nggak ada yang perlu di-price.", flags: MessageFlags.Ephemeral });
  }

  return interaction.reply({
    content: "🏷️ **Price One** — select item:",
    components: [buildSetPriceRow(panel)],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleSetPrice, handleSetPriceOne, buildSetPriceRow };
