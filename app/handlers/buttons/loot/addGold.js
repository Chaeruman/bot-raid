const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { showGoldExcludeSelect } = require("../../selectMenus/loot/goldExclude");
const { buildGoldModal } = require("../../../builders/goldModal");
const { setPendingEphemeral } = require("../../../state");
const { partySize } = require("../../../builders/lootPanel");

async function handleAddGold(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can add gold.", flags: MessageFlags.Ephemeral });
  }

  // The party that actually ran it, not a fixed eight. A seven-man run splits
  // its normal gold seven ways and its HC gold six.
  const size = partySize(panel);
  const hc = size - 1;

  if (panel.hcGoldSplit === "mixed") {
    // Marathon: tanya dulu HC atau Normal
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`loot-sel:gold_type:${panel.lootMsgId}`)
        .setPlaceholder("Pilih tipe split gold")
        .addOptions([
          { label: `HC (÷${hc})`, value: String(hc), description: `Gold dari HC run — dibagi ${hc} member` },
          { label: `Normal (÷${size})`, value: String(size), description: `Gold dari run biasa — dibagi ${size} member` },
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
    await showGoldExcludeSelect(interaction, panel, hc);
    setPendingEphemeral(panel.lootMsgId, interaction.user.id, interaction);
    return;
  }

  // Normal: langsung modal, tidak ada yang dikecualikan
  return interaction.showModal(buildGoldModal(panel, size));
}

module.exports = { handleAddGold };
