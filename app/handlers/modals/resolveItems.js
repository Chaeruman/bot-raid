const { MessageFlags } = require("discord.js");
const { activeLootPanels, saveState, takePendingResolution } = require("../../state");
const { CATALOG } = require("../../items");
const { refreshLootPanel } = require("../../builders/lootPanel");

function addToPanel(panel, itemKey, qty) {
  const existing = panel.items.find((i) => i.itemKey === itemKey && i.detail === null);
  if (existing) existing.qty += qty;
  else panel.items.push({ itemKey, qty, price: null, detail: null });
}

async function handleResolveItemsModal(interaction) {
  // customId: loot-modal:resolve_items:{lootMsgId}
  const lootMsgId = interaction.customId.split(":")[2];

  const panel = activeLootPanels[lootMsgId];
  if (!panel || panel.closed) {
    return interaction.reply({ content: "❌ Loot panel not found.", flags: MessageFlags.Ephemeral });
  }

  const pending = takePendingResolution(lootMsgId, interaction.user.id);
  if (!pending) {
    return interaction.reply({ content: "❌ Nothing to resolve (it may have expired).", flags: MessageFlags.Ephemeral });
  }

  const nums = interaction.fields.getTextInputValue("choices").split(",").map((s) => parseInt(s.trim(), 10));

  const added = [];
  const skipped = [];
  pending.forEach((u, i) => {
    const choice = nums[i];
    if (!choice || choice < 1 || choice > u.candidates.length) {
      skipped.push(u.raw);
      return;
    }
    const picked = u.candidates[choice - 1];
    addToPanel(panel, picked.key, u.qty);
    added.push({ name: CATALOG[picked.key].name, qty: u.qty });
  });

  if (added.length) saveState();

  const lines = [];
  if (added.length) {
    lines.push(`✅ Added ${added.length} item(s):`);
    for (const a of added) lines.push(`• ${a.name} ×${a.qty}`);
  }
  if (skipped.length) {
    lines.push(`${lines.length ? "\n" : ""}⏭️ Skipped ${skipped.length} line(s):`);
    for (const s of skipped) lines.push(`• \`${s}\``);
  }
  if (!lines.length) lines.push("Nothing resolved.");

  await interaction.update({ content: lines.join("\n").slice(0, 2000), components: [] });
  if (added.length) await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleResolveItemsModal };
