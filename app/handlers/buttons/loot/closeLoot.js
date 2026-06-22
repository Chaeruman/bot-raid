const { MessageFlags } = require("discord.js");
const { activeLootPanels, saveState } = require("../../../state");
const { refreshLootPanel } = require("../../../builders/lootPanel");

async function handleCloseLoot(interaction, panel) {
  if (interaction.user.id !== panel.hostId) {
    return interaction.reply({ content: "⛔ Only the host can close the loot panel.", flags: MessageFlags.Ephemeral });
  }

  const unpaid = panel.members.filter((uid) => !panel.payments[uid]);
  if (unpaid.length > 0) {
    return interaction.reply({
      content: `❌ Belum semua member menerima gaji:\n${unpaid.map((uid) => `• <@${uid}>`).join("\n")}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  panel.closed = true;

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);

  delete activeLootPanels[panel.lootMsgId];
  saveState();
}

module.exports = { handleCloseLoot };
