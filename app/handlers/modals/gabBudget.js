const { MessageFlags } = require("discord.js");
const { evalPrice } = require("../../utils/evalPrice");
const { buildUnpaidView } = require("../commands/combinedPay");

// customId: gab-budget-modal:{sellerId}
async function handleGabBudgetModal(interaction) {
  const sellerId = interaction.customId.slice("gab-budget-modal:".length);
  if (interaction.user.id !== sellerId) {
    return interaction.reply({ content: "⛔ Bukan panel kamu.", flags: MessageFlags.Ephemeral });
  }

  const budget = evalPrice(interaction.fields.getTextInputValue("budget"));
  if (budget == null || budget <= 0) {
    return interaction.reply({ content: "❌ Budget nggak valid — masukin angka gold.", flags: MessageFlags.Ephemeral });
  }

  // Rebuilding the view fetches every unpaid member's guild profile —
  // can exceed Discord's 3s ack window, so defer before that work starts.
  await interaction.deferUpdate();

  const view = await buildUnpaidView(interaction.client, interaction.guild, sellerId, budget);
  if (!view) {
    return interaction.editReply({ content: "🎉 Semua member sudah lunas.", components: [] });
  }
  return interaction.editReply({
    content: view.content.slice(0, 2000),
    components: view.components,
  });
}

module.exports = { handleGabBudgetModal };
