const { saveState } = require("../../../state");
const { refreshLootPanel } = require("../../../builders/lootPanel");

async function handleRemoveMemberSelect(interaction, panel) {
  const removed = interaction.values;
  panel.members = panel.members.filter((id) => !removed.includes(id));
  for (const id of removed) {
    delete panel.payments[id];
    // A bonus for someone no longer on the panel is money aimed at nobody, and
    // it would keep showing on the summary with no member line to explain it.
    if (panel.bonuses) delete panel.bonuses[id];
  }
  saveState();

  await interaction.update({
    content: `✅ Removed ${removed.map((u) => `<@${u}>`).join(", ")}.`,
    components: [],
  });
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleRemoveMemberSelect };
