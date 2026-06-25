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
    .setTitle("Add Items");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("items")
        .setLabel("One item per line (or | separated)")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          "gdn armor warrior head\ngdn fragment x5\nstorm u junk\nddn unique accessory ring hybrid",
        )
        .setRequired(true),
    ),
  );

  return interaction.showModal(modal);
}

module.exports = { buildAddItemRow, handleAddItem };
