const { MessageFlags } = require("discord.js");
const { activeLootPanels, saveState } = require("../../state");
const { CATALOG } = require("../../items");
const { refreshLootPanel } = require("../../builders/lootPanel");

async function handleSetPricesModal(interaction) {
  // customId: loot-modal:set_prices:{lootMsgId}
  const lootMsgId = interaction.customId.split(":")[2];

  const panel = activeLootPanels[lootMsgId];
  if (!panel || panel.closed) {
    return interaction.reply({ content: "❌ Loot panel not found.", flags: MessageFlags.Ephemeral });
  }
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can set prices.", flags: MessageFlags.Ephemeral });
  }

  const text = interaction.fields.getTextInputValue("prices");
  const updated = [];

  for (const line of text.split("\n")) {
    const idxM = line.match(/^\s*(\d+)/);
    if (!idxM) continue;
    const item = panel.items[parseInt(idxM[1], 10) - 1];
    if (!item) continue;

    // Price is in the LAST () on the line (detail may have its own brackets).
    const brackets = [...line.matchAll(/\(([^)]*)\)/g)];
    if (!brackets.length) continue;
    const raw = brackets[brackets.length - 1][1].replace(/[,\sgG]/g, "");
    if (raw === "") continue; // left blank → leave unchanged

    const price = parseInt(raw, 10);
    if (isNaN(price) || price < 0) continue;

    item.price = price;
    updated.push({ name: CATALOG[item.itemKey].name, detail: item.detail, price });
  }

  if (updated.length) saveState();

  const lines = [];
  if (updated.length) {
    lines.push(`✅ Set price on ${updated.length} item(s):`);
    for (const u of updated) {
      const d = u.detail ? ` (${u.detail})` : "";
      lines.push(`• ${u.name}${d} — ${u.price.toLocaleString()}g`);
    }
  }
  const unpriced = panel.items.filter((i) => i.price == null).length;
  if (unpriced) lines.push(`${lines.length ? "\n" : ""}⚠️ ${unpriced} item(s) still without a price.`);
  if (!lines.length) lines.push("No prices changed.");

  await interaction.reply({ content: lines.join("\n").slice(0, 2000), flags: MessageFlags.Ephemeral });
  if (updated.length) await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleSetPricesModal };
