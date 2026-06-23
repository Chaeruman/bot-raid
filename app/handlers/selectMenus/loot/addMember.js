const { saveState } = require("../../../state");
const { refreshLootPanel } = require("../../../builders/lootPanel");
const { buildAddMemberRow } = require("../../buttons/loot/addMember");

async function handleAddMemberSelect(interaction, panel) {
  const userId = interaction.values[0];
  const row = buildAddMemberRow(panel);

  if (panel.members.includes(userId)) {
    await interaction.update({
      content: `⚠️ <@${userId}> is already in the panel. Add another or dismiss.`,
      components: [row],
    });
    return;
  }

  panel.members.push(userId);
  panel.payments[userId] = false;
  saveState();

  await interaction.update({
    content: `✅ Added <@${userId}>. Add another or dismiss.`,
    components: [row],
  });
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleAddMemberSelect };
