const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require("discord.js");

// customId: gab-budget:{sellerId}
async function handleGabBudgetButton(interaction) {
  const sellerId = interaction.customId.slice("gab-budget:".length);
  if (interaction.user.id !== sellerId) {
    return interaction.reply({ content: "⛔ Bukan panel kamu.", flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(`gab-budget-modal:${sellerId}`)
    .setTitle("Cek Budget Kirim Gaji");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("budget")
        .setLabel("Gold di char ini")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 500000")
        .setRequired(true),
    ),
  );

  return interaction.showModal(modal);
}

module.exports = { handleGabBudgetButton };
