const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { CATEGORIES } = require("../../../items");

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

  return interaction.reply({
    content: `➕ **Add Item** — current source: **${panel.source === "raid" ? "📥 Raid Drops" : "✉️ Mail"}**\nSelect a category:`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleAddItem };
