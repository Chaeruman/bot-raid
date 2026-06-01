const { MessageFlags } = require("discord.js");
const { activeLootPanels } = require("../../../state");
const { handleSellerSelect } = require("./sellerSelect");
const { handleItemCategory } = require("./itemCategory");
const { handleItemSelect } = require("./itemSelect");
const { handleGoldType } = require("./goldType");
const { handlePriceItem } = require("./priceItem");
const { handleMarkPaidSelect } = require("./markPaid");

async function handleLootSelect(interaction) {
  // customId: loot-sel:{action}:{lootMsgId}[:{extra}]
  const withoutPrefix = interaction.customId.slice("loot-sel:".length);
  const parts = withoutPrefix.split(":");
  const action = parts[0];
  const lootMsgId = parts[1];
  const extra = parts[2]; // optional (e.g. source for gold_type)

  const panel = activeLootPanels[lootMsgId];
  if (!panel) {
    return interaction.reply({ content: "❌ Loot panel not found.", flags: MessageFlags.Ephemeral });
  }
  if (panel.closed) {
    return interaction.reply({ content: "🔒 This loot panel is closed.", flags: MessageFlags.Ephemeral });
  }

  switch (action) {
    case "seller":     return handleSellerSelect(interaction, panel);
    case "category":   return handleItemCategory(interaction, panel);
    case "item":       return handleItemSelect(interaction, panel);
    case "gold_type":  return handleGoldType(interaction, panel, extra || panel.source);
    case "price_item": return handlePriceItem(interaction, panel);
    case "mark_paid":  return handleMarkPaidSelect(interaction, panel);
    default:
      return interaction.reply({ content: "❌ Unknown loot action.", flags: MessageFlags.Ephemeral });
  }
}

module.exports = { handleLootSelect };
