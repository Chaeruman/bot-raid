const { MessageFlags } = require("discord.js");
const { activeLootPanels } = require("../../state");
const { refreshLootPanel } = require("../../builders/lootPanel");

async function handleGoldEntryModal(interaction) {
  // customId: loot-modal:gold:{lootMsgId}:{splitCount}:{source}:{excludedUserId|none}
  const parts = interaction.customId.split(":");
  const lootMsgId      = parts[2];
  const splitCount     = parseInt(parts[3], 10);
  const source         = parts[4];
  const excludedUserId = parts[5] && parts[5] !== "none" ? parts[5] : null;

  const panel = activeLootPanels[lootMsgId];
  if (!panel || panel.closed) {
    return interaction.reply({ content: "❌ Loot panel not found.", flags: MessageFlags.Ephemeral });
  }

  const rawAmount = interaction.fields.getTextInputValue("amount").trim().replace(/,/g, "");
  const amount = parseInt(rawAmount, 10);
  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({ content: "❌ Invalid gold amount. Enter a positive number.", flags: MessageFlags.Ephemeral });
  }

  panel.goldEntries.push({ amount, splitCount, source, excludedUserId });

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleGoldEntryModal };
