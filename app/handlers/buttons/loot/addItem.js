const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");
const { CATEGORIES } = require("../../../items");

// Still used by the select-based flow (kept for reference / re-show).
function buildAddItemRow(panel) {
  const options = CATEGORIES.map((cat) => ({
    label: cat.label,
    value: cat.key,
    description: `${cat.items.length} items`,
  }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:category:${panel.lootMsgId}`)
      .setPlaceholder("Select item category")
      .addOptions(options),
  );
}

async function handleAddItem(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can add items.", flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:add_items:${panel.lootMsgId}`)
    .setTitle("Add Items & Gold");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("items")
        .setLabel("One per line (items or gold, | separated)")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          "gdn (one piece)\ngdn fragment x5\nstorm u junk\ngold 294/7\n258/8",
        )
        .setRequired(true),
    ),
  );

  return interaction.showModal(modal);
}

// 📋 Browse — the tap-through category → item select flow (mobile-friendly).
async function handleBrowseItem(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can add items.", flags: MessageFlags.Ephemeral });
  }

  return interaction.reply({
    content: "📋 **Browse** — select a category:",
    components: [buildAddItemRow(panel)],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { buildAddItemRow, handleAddItem, handleBrowseItem };
