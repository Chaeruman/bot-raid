const { saveState } = require("../../../state");
const { refreshLootPanel } = require("../../../builders/lootPanel");
const { buildAddMemberRow } = require("../../buttons/loot/addMember");

async function handleAddMemberSelect(interaction, panel) {
  const added = [];
  const dupes = [];
  for (const userId of interaction.values) {
    if (panel.members.includes(userId)) {
      dupes.push(userId);
      continue;
    }
    panel.members.push(userId);
    panel.payments[userId] = false;
    added.push(userId);
  }
  if (added.length) saveState();

  const parts = [];
  if (added.length) parts.push(`✅ Added ${added.map((u) => `<@${u}>`).join(", ")}.`);
  if (dupes.length) parts.push(`⚠️ Already in: ${dupes.map((u) => `<@${u}>`).join(", ")}.`);
  parts.push("Add more or dismiss.");

  await interaction.update({ content: parts.join(" "), components: [buildAddMemberRow(panel)] });
  if (added.length) await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleAddMemberSelect };
