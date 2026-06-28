const { refreshLootPanel } = require("../../../builders/lootPanel");
const { activeLootPanels, saveState } = require("../../../state");
const { buildMarkPaidRow } = require("../../buttons/loot/markPaid");

async function handleMarkPaidSelect(interaction, panel) {
  for (const uid of interaction.values) {
    panel.payments[uid] = !panel.payments[uid];
  }

  // Auto-close once everyone has been paid
  const allPaid = panel.members.length > 0 && panel.members.every((uid) => panel.payments[uid]);
  if (allPaid) panel.closed = true;
  saveState();

  if (allPaid) {
    await interaction.update({ content: "✅ All members paid — panel closed.", components: [] });
    await refreshLootPanel(interaction.client, panel);
    delete activeLootPanels[panel.lootMsgId];
    saveState();
    return;
  }

  // Keep the picker open with refreshed paid/unpaid statuses
  const row = await buildMarkPaidRow(interaction, panel);
  await interaction.update({
    content: "💳 **Mark Paid** — select member to toggle (you can toggle several):",
    components: [row],
  });
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleMarkPaidSelect };
