const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { setPendingEphemeral } = require("../../../state");

async function handleRemoveGold(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can remove gold.", flags: MessageFlags.Ephemeral });
  }

  if (panel.goldEntries.length === 0) {
    return interaction.reply({ content: "❌ No gold drops to remove.", flags: MessageFlags.Ephemeral });
  }

  const options = panel.goldEntries.map((g, idx) => {
    const excl = g.excludedUserId ? " (excl. 1)" : "";
    return {
      label: `${g.amount.toLocaleString()}g ÷${g.splitCount}${excl}`.slice(0, 100),
      value: String(idx),
    };
  });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:remove_gold:${panel.lootMsgId}`)
      .setPlaceholder("Select gold drop to remove")
      .addOptions(options),
  );

  await interaction.reply({
    content: "🗑️ **Remove Gold** — select drop:",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
  setPendingEphemeral(panel.lootMsgId, interaction.user.id, interaction);
}

module.exports = { handleRemoveGold };
