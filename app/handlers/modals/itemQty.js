const { MessageFlags } = require("discord.js");
const { activeLootPanels, saveState, clearPendingEphemeral } = require("../../state");
const { CATALOG } = require("../../items");
const { refreshLootPanel } = require("../../builders/lootPanel");

async function handleItemQtyModal(interaction) {
  // customId: loot-modal:item_qty:{lootMsgId}:{itemKey}[:{detail}]
  // detail (optional) encoded as "Class@Part" or "Type@Subtype"
  const parts = interaction.customId.split(":");
  const lootMsgId = parts[2];
  const itemKey   = parts[3];
  const rawDetail = parts[4] || null; // e.g. "Warrior@Head" or "Ring@Hybrid"
  const detail    = rawDetail ? rawDetail.replace("@", " — ") : null;

  const panel = activeLootPanels[lootMsgId];
  if (!panel || panel.closed) {
    return interaction.reply({ content: "❌ Loot panel not found.", flags: MessageFlags.Ephemeral });
  }

  const rawQty = interaction.fields.getTextInputValue("qty").trim();
  const qty = parseInt(rawQty, 10);
  if (isNaN(qty) || qty <= 0) {
    return interaction.reply({ content: "❌ Invalid quantity. Enter a positive number.", flags: MessageFlags.Ephemeral });
  }

  const def = CATALOG[itemKey];
  if (!def) {
    return interaction.reply({ content: "❌ Unknown item.", flags: MessageFlags.Ephemeral });
  }

  const existing = panel.items.find((i) => i.itemKey === itemKey && i.detail === detail);
  if (existing) {
    existing.qty += qty;
  } else {
    panel.items.push({ itemKey, qty, price: null, detail });
  }
  saveState();

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
  clearPendingEphemeral(lootMsgId, interaction.user.id);
}

module.exports = { handleItemQtyModal };
