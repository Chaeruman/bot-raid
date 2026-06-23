const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { CATALOG } = require("../../../items");
const { setPendingEphemeral } = require("../../../state");

async function handleRemoveItem(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can remove items.", flags: MessageFlags.Ephemeral });
  }

  if (panel.items.length === 0) {
    return interaction.reply({ content: "❌ No items to remove.", flags: MessageFlags.Ephemeral });
  }

  const options = panel.items.map((item, idx) => {
    const def = CATALOG[item.itemKey];
    const detailStr = item.detail ? ` (${item.detail})` : "";
    const priceStr = item.price != null ? ` — ${item.price.toLocaleString()}g` : " — no price";
    return {
      label: `${def.name}${detailStr}`.slice(0, 100),
      value: String(idx),
      description: `${item.qty}x${priceStr}`.slice(0, 100),
    };
  });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:remove_item:${panel.lootMsgId}`)
      .setPlaceholder("Select item to remove")
      .addOptions(options),
  );

  await interaction.reply({
    content: "🗑️ **Remove Item** — select item:",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
  setPendingEphemeral(panel.lootMsgId, interaction.user.id, interaction);
}

module.exports = { handleRemoveItem };
