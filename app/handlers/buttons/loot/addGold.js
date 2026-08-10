const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { showGoldExcludeSelect } = require("../../selectMenus/loot/goldExclude");
const { buildGoldModal } = require("../../../builders/goldModal");
const { setPendingEphemeral } = require("../../../state");

async function handleAddGold(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can add gold.", flags: MessageFlags.Ephemeral });
  }

  if (panel.hcGoldSplit === "mixed") {
    // Marathon: tanya dulu HC atau Normal
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`loot-sel:gold_type:${panel.lootMsgId}`)
        .setPlaceholder("Pilih tipe split gold")
        .addOptions([
          { label: "HC (÷7)", value: "7", description: "Gold dari HC run — dibagi 7 member" },
          { label: "Normal (÷8)", value: "8", description: "Gold dari run biasa — dibagi 8 member" },
        ]),
    );
    await interaction.reply({
      content: "Pilih tipe split gold:",
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
    setPendingEphemeral(panel.lootMsgId, interaction.user.id, interaction);
    return;
  }

  if (panel.hcGoldSplit === true) {
    // HC fixed: pilih siapa yang tidak dapat dulu
    await showGoldExcludeSelect(interaction, panel, 7);
    setPendingEphemeral(panel.lootMsgId, interaction.user.id, interaction);
    return;
  }

  // Normal (÷8): langsung modal, tidak ada yang dikecualikan
  return interaction.showModal(buildGoldModal(panel, 8));
}

module.exports = { handleAddGold };
