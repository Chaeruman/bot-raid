const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { CATALOG } = require("../../../items");

async function handleSetPrice(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can set prices.", flags: MessageFlags.Ephemeral });
  }

  const allItems = [...panel.raidItems, ...panel.mailItems];
  if (allItems.length === 0) {
    return interaction.reply({ content: "❌ No items added yet.", flags: MessageFlags.Ephemeral });
  }

  const options = allItems.map((item) => {
    const def = CATALOG[item.itemKey];
    const src = panel.raidItems.includes(item) ? "Raid" : "Mail";
    const priceStr = item.price != null ? ` — ${item.price.toLocaleString()}g` : " — no price";
    return {
      label: `${def.name} (${src})`.slice(0, 100),
      value: item.itemKey,
      description: `${item.qty}x${priceStr}`.slice(0, 100),
    };
  });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:price_item:${panel.lootMsgId}`)
      .setPlaceholder("Select item to set price")
      .addOptions(options),
  );

  return interaction.reply({
    content: "🏷️ **Set Price** — select item:",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleSetPrice };
