const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { CATALOG, CATEGORIES } = require("../../../items");

async function handleItemCategory(interaction, panel) {
  // customId: loot-sel:category:{lootMsgId}
  // value is just the categoryKey
  const categoryKey = interaction.values[0];
  const category = CATEGORIES.find((c) => c.key === categoryKey);
  if (!category) {
    return interaction.reply({ content: "❌ Unknown category.", flags: MessageFlags.Ephemeral });
  }

  const options = category.items.map((itemKey) => {
    const def = CATALOG[itemKey];
    return {
      label: def.name.slice(0, 100),
      value: itemKey,
      description: `${def.stampsPerUnit} stamps/unit`,
    };
  });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:item:${panel.lootMsgId}`)
      .setPlaceholder("Select item")
      .addOptions(options),
  );

  return interaction.update({
    content: `➕ **${category.label}** — select item (source: **${panel.source === "raid" ? "📥 Raid" : "✉️ Mail"}**):`,
    components: [row],
  });
}

module.exports = { handleItemCategory };
