const { refreshLootPanel, memberSalary } = require("../../../builders/lootPanel");
const { activeLootPanels, saveState, recordSalaryPaid, removeSalaryPaid } = require("../../../state");
const { checkTop5Records } = require("../../../salaryRecords");
const { buildMarkPaidRow } = require("../../buttons/loot/markPaid");

async function handleMarkPaidSelect(interaction, panel) {
  for (const uid of interaction.values) {
    panel.payments[uid] = !panel.payments[uid];
    // Only track earnings for panels created after the stampRate rollout (today's cutover).
    if (panel.stampRate != null) {
      if (panel.payments[uid]) {
        recordSalaryPaid(panel.lootMsgId, uid, memberSalary(panel, uid), {
          sellerId: panel.sellerId,
          panelTitle: panel.eventTitle,
          threadId: panel.threadId,
        });
      }
      else removeSalaryPaid(panel.lootMsgId, uid);
    }
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
    if (panel.stampRate != null) checkTop5Records(interaction.client, panel).catch((err) => console.error("❌ checkTop5Records failed:", err.message));
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
