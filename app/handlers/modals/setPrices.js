const { MessageFlags } = require("discord.js");
const { activeLootPanels, saveState } = require("../../state");
const { CATALOG } = require("../../items");
const { refreshLootPanel } = require("../../builders/lootPanel");
const { evalPrice } = require("../../utils/evalPrice");

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

    let changed = false;

    // Inline note after '#' (present but empty → clears the note).
    const hashIdx = line.indexOf("#");
    const body = hashIdx >= 0 ? line.slice(0, hashIdx) : line;
    if (hashIdx >= 0) {
      const note = line.slice(hashIdx + 1).trim() || null;
      if (item.note !== note) { item.note = note; changed = true; }
    }

    // Price = expression after the last "=" (math ok). Blank → unchanged.
    const eqIdx = body.lastIndexOf("=");
    if (eqIdx >= 0) {
      const price = evalPrice(body.slice(eqIdx + 1));
      if (price != null && item.price !== price) {
        item.price = price;
        changed = true;
      }
    }

    if (changed) updated.push({ name: CATALOG[item.itemKey].name, detail: item.detail, price: item.price });
  }

  if (updated.length) saveState();

  const lines = [];
  if (updated.length) {
    lines.push(`✅ Updated ${updated.length} item(s):`);
    for (const u of updated) {
      const d = u.detail ? ` (${u.detail})` : "";
      const p = u.price != null ? `${u.price.toLocaleString()}g` : "(note only)";
      lines.push(`• ${u.name}${d} — ${p}`);
    }
  }
  const unpriced = panel.items.filter((i) => i.price == null).length;
  if (unpriced) lines.push(`${lines.length ? "\n" : ""}⚠️ ${unpriced} item(s) still without a price.`);
  if (!lines.length) lines.push("No prices changed.");

  await interaction.reply({ content: lines.join("\n").slice(0, 2000), flags: MessageFlags.Ephemeral });
  if (updated.length) await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleSetPricesModal };
