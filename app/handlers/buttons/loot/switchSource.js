const { MessageFlags } = require("discord.js");
const { refreshLootPanel } = require("../../../builders/lootPanel");

async function handleSwitchSource(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can switch the source.", flags: MessageFlags.Ephemeral });
  }

  panel.source = panel.source === "raid" ? "mail" : "raid";

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleSwitchSource };
