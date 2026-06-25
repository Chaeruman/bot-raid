const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");

async function handleResolveItems(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can resolve items.", flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:resolve_items:${panel.lootMsgId}`)
    .setTitle("Resolve Items");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("choices")
        .setLabel("One number per line, comma-separated")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 1, 2, 1   (0 to skip)")
        .setRequired(true),
    ),
  );

  return interaction.showModal(modal);
}

module.exports = { handleResolveItems };
