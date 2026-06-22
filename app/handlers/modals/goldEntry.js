const { MessageFlags } = require("discord.js");
const { activeLootPanels, saveState, clearPendingEphemeral } = require("../../state");
const { refreshLootPanel } = require("../../builders/lootPanel");

async function handleGoldEntryModal(interaction) {
  // customId: loot-modal:gold:{lootMsgId}:{splitCount}:{excludedUserId|none}
  const parts = interaction.customId.split(":");
  const lootMsgId      = parts[2];
  const splitCount     = parseInt(parts[3], 10);
  const excludedUserId = parts[4] && parts[4] !== "none" ? parts[4] : null;

  const panel = activeLootPanels[lootMsgId];
  if (!panel || panel.closed) {
    return interaction.reply({ content: "❌ Loot panel not found.", flags: MessageFlags.Ephemeral });
  }

  const rawAmount = interaction.fields.getTextInputValue("amount").trim().replace(/,/g, "");
  const amount = parseInt(rawAmount, 10);
  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({ content: "❌ Invalid gold amount. Enter a positive number.", flags: MessageFlags.Ephemeral });
  }

  panel.goldEntries.push({ amount, splitCount, excludedUserId });
  saveState();

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
  clearPendingEphemeral(lootMsgId, interaction.user.id);
}

module.exports = { handleGoldEntryModal };
