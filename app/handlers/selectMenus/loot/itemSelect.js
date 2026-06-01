const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require("discord.js");
const { CATALOG } = require("../../../items");

async function handleItemSelect(interaction, panel) {
  // customId: loot-sel:item:{lootMsgId}
  const itemKey = interaction.values[0];
  const def = CATALOG[itemKey];
  if (!def) {
    return interaction.reply({ content: "❌ Unknown item.", flags: MessageFlags.Ephemeral });
  }

  const source = panel.source;
  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:item_qty:${panel.lootMsgId}:${itemKey}:${source}`)
    .setTitle(`Add: ${def.name.slice(0, 40)}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("qty")
        .setLabel(`Quantity (${def.stampsPerUnit} stamps each)`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 1")
        .setRequired(true),
    ),
  );

  return interaction.showModal(modal);
}

module.exports = { handleItemSelect };
