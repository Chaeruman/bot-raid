const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require("discord.js");
const { CATALOG } = require("../../../items");

async function handlePriceItem(interaction, panel) {
  // customId: loot-sel:price_item:{lootMsgId}
  // value is the index into panel.items
  const idx = parseInt(interaction.values[0], 10);
  const item = panel.items[idx];
  if (!item) {
    return interaction.reply({ content: "❌ Item not found.", flags: MessageFlags.Ephemeral });
  }

  const def = CATALOG[item.itemKey];
  const detailStr = item.detail ? ` (${item.detail})` : "";
  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:item_price:${panel.lootMsgId}:${idx}`)
    .setTitle("Set Item Price");

  const itemLabel = `${def.name}${detailStr}`.slice(0, 40);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("price")
        .setLabel(def.type === "quantity" ? `Total price: ${itemLabel}`.slice(0, 45) : `Price: ${itemLabel}`.slice(0, 45))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(item.price != null ? String(item.price) : "e.g. 50000")
        .setValue(item.price != null ? String(item.price) : "")
        .setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("note")
        .setLabel("Note (optional)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. for Budi")
        .setValue(item.note || "")
        .setMaxLength(100)
        .setRequired(false),
    ),
  );

  return interaction.showModal(modal);
}

module.exports = { handlePriceItem };
