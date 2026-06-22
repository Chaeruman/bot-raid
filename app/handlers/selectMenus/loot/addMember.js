const { saveState, clearPendingEphemeral } = require("../../../state");
const { refreshLootPanel } = require("../../../builders/lootPanel");

async function handleAddMemberSelect(interaction, panel) {
  const userId = interaction.values[0];

  if (panel.members.includes(userId)) {
    await interaction.update({ content: "⚠️ Member is already in the panel.", components: [] });
    return;
  }

  panel.members.push(userId);
  panel.payments[userId] = false;
  saveState();

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
  clearPendingEphemeral(panel.lootMsgId, interaction.user.id);
}

module.exports = { handleAddMemberSelect };
