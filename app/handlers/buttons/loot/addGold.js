const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const { showGoldExcludeSelect } = require("../../selectMenus/loot/goldExclude");

async function handleAddGold(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can add gold.", flags: MessageFlags.Ephemeral });
  }

  const source = panel.source;

  if (panel.hcGoldSplit === "mixed") {
    // Marathon: tanya dulu HC atau Normal
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`loot-sel:gold_type:${panel.lootMsgId}:${source}`)
        .setPlaceholder("Pilih tipe split gold")
        .addOptions([
          { label: "HC (÷7)", value: "7", description: "Gold dari HC run — dibagi 7 member" },
          { label: "Normal (÷8)", value: "8", description: "Gold dari run biasa — dibagi 8 member" },
        ]),
    );
    return interaction.reply({
      content: "Pilih tipe split gold:",
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (panel.hcGoldSplit === true) {
    // HC fixed: pilih siapa yang tidak dapat dulu
    return showGoldExcludeSelect(interaction, panel, source, 7);
  }

  // Normal (÷8): langsung modal, tidak ada yang dikecualikan
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

module.exports = { handleAddGold };
