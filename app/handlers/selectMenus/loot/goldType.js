const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

async function handleGoldType(interaction, panel, source) {
  // customId: loot-sel:gold_type:{lootMsgId}:{source}
  const splitCount = parseInt(interaction.values[0], 10); // 7 or 8

  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:gold:${panel.lootMsgId}:${splitCount}:${source}`)
    .setTitle(`Add Gold (÷${splitCount})`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("amount")
        .setLabel(`Gold amount (split ÷${splitCount})`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 100000")
        .setRequired(true),
    ),
  );

  return interaction.showModal(modal);
}

module.exports = { handleGoldType };
