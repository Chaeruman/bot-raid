const { MessageFlags } = require("discord.js");
const { activeLootPanels } = require("../../state");
const { CATALOG } = require("../../items");
const { refreshLootPanel } = require("../../builders/lootPanel");

async function handleItemQtyModal(interaction) {
  // customId: loot-modal:item_qty:{lootMsgId}:{itemKey}:{source}
  const parts = interaction.customId.split(":");
  const lootMsgId = parts[2];
  const itemKey = parts[3];
  const source = parts[4]; // "raid" or "mail"

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

  const list = source === "mail" ? panel.mailItems : panel.raidItems;
  const existing = list.find((i) => i.itemKey === itemKey);
  if (existing) {
    existing.qty += qty;
  } else {
    list.push({ itemKey, qty, price: null });
  }

  await interaction.deferUpdate();
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleItemQtyModal };
