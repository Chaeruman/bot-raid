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

    // #note comes before "=", price comes after it (rightmost).
    const eqIdx = line.lastIndexOf("=");
    if (eqIdx < 0) continue;
    let left = line.slice(0, eqIdx);
    const right = line.slice(eqIdx + 1);

    let changed = false;

    // "gacha" keyword marks an item not-for-sale retroactively, even if it
    // wasn't typed with "gacha" originally in Type Items. One-directional
    // (only sets it) — matches the same keyword parseItems.js recognizes.
    if (/\bgacha\b/i.test(left)) {
      left = left.replace(/\bgacha\b/i, " ").replace(/\s+/g, " ");
      if (!item.notForSale) { item.notForSale = true; changed = true; }
    }

    // Inline note after '#' (present but empty → clears the note).
    const hashIdx = left.indexOf("#");
    if (hashIdx >= 0) {
      const note = left.slice(hashIdx + 1).trim() || null;
      if (item.note !== note) { item.note = note; changed = true; }
    }

    // Price = expression after "=" (math ok). Blank → clears the price
    // (e.g. reverting to "unpriced" after a mistaken entry). Non-blank but
    // unparseable is left unchanged rather than silently wiped.
    if (right.trim() === "") {
      if (item.price !== null) { item.price = null; changed = true; }
    } else {
      const price = evalPrice(right);
      if (price != null && item.price !== price) {
        item.price = price;
        changed = true;
      }
    }

    if (changed) updated.push({ name: CATALOG[item.itemKey].name, detail: item.detail, price: item.price, notForSale: item.notForSale });
  }

  if (updated.length) saveState();

  const lines = [];
  if (updated.length) {
    lines.push(`✅ Updated ${updated.length} item(s):`);
    for (const u of updated) {
      const d = u.detail ? ` (${u.detail})` : "";
      const p = u.notForSale ? "🎁 gacha, tidak dijual" : u.price != null ? `${u.price.toLocaleString()}g` : "(note only)";
      lines.push(`• ${u.name}${d} — ${p}`);
    }
  }
  const unpriced = panel.items.filter((i) => i.price == null && !i.notForSale).length;
  if (unpriced) lines.push(`${lines.length ? "\n" : ""}⚠️ ${unpriced} item(s) still without a price.`);
  if (!lines.length) lines.push("No prices changed.");

  await interaction.reply({ content: lines.join("\n").slice(0, 2000), flags: MessageFlags.Ephemeral });
  if (updated.length) await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleSetPricesModal };
