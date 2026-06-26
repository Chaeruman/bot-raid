const { saveState } = require("../../../state");
const { refreshLootPanel } = require("../../../builders/lootPanel");

async function handleRemoveMemberSelect(interaction, panel) {
  const removed = interaction.values;
  panel.members = panel.members.filter((id) => !removed.includes(id));
  for (const id of removed) delete panel.payments[id];
  saveState();

  await interaction.update({
    content: `✅ Removed ${removed.map((u) => `<@${u}>`).join(", ")}.`,
    components: [],
  });
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleRemoveMemberSelect };
