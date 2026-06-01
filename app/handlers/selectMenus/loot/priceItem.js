const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { CATALOG } = require("../../../items");

async function handlePriceItem(interaction, panel) {
  // customId: loot-sel:price_item:{lootMsgId}
  const itemKey = interaction.values[0];
  const def = CATALOG[itemKey];

  const allItems = [...panel.raidItems, ...panel.mailItems];
  const item = allItems.find((i) => i.itemKey === itemKey);

  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:item_price:${panel.lootMsgId}:${itemKey}`)
    .setTitle(`Price: ${def.name.slice(0, 40)}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("price")
        .setLabel("Price in gold")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(item?.price != null ? String(item.price) : "e.g. 50000")
        .setValue(item?.price != null ? String(item.price) : "")
        .setRequired(true),
    ),
  );

  return interaction.showModal(modal);
}

module.exports = { handlePriceItem };
