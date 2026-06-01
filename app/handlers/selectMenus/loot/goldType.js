const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { showGoldExcludeSelect } = require("./goldExclude");

async function handleGoldType(interaction, panel, source) {
  // customId: loot-sel:gold_type:{lootMsgId}:{source}
  const splitCount = parseInt(interaction.values[0], 10); // 7 or 8

  if (splitCount === 7) {
    // HC: pilih siapa yang tidak dapat dulu
    return showGoldExcludeSelect(interaction, panel, source, 7);
  }

  // Normal (÷8): langsung modal
  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:gold:${panel.lootMsgId}:8:${source}:none`)
    .setTitle("Add Gold (÷8)");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("amount")
        .setLabel("Jumlah gold (dibagi 8 orang)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 100000")
        .setRequired(true),
    ),
  );

  return interaction.showModal(modal);
}

module.exports = { handleGoldType };
