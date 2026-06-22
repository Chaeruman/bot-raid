const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { CATEGORIES } = require("../../../items");
const { setPendingEphemeral } = require("../../../state");

async function handleAddItem(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can add items.", flags: MessageFlags.Ephemeral });
  }

  const options = CATEGORIES.map((cat) => ({
    label: cat.label,
    value: cat.key,
    description: `${cat.items.length} items`,
  }));

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:category:${panel.lootMsgId}`)
      .setPlaceholder("Select item category")
      .addOptions(options),
  );

  await interaction.reply({
    content: "➕ **Add Item** — select a category:",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
  setPendingEphemeral(panel.lootMsgId, interaction.user.id, interaction);
}

module.exports = { handleAddItem };
