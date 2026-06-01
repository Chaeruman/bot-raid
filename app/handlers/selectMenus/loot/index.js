const { MessageFlags } = require("discord.js");
const { activeLootPanels } = require("../../../state");
const { handleSellerSelect } = require("./sellerSelect");
const { handleItemCategory } = require("./itemCategory");
const { handleItemSelect } = require("./itemSelect");
const { handleEquipPart } = require("./equipPart");
const { handleEquipClass } = require("./equipClass");
const { handleAccType } = require("./accType");
const { handleAccSubtype } = require("./accSubtype");
const { handleGoldType } = require("./goldType");
const { handleGoldExclude } = require("./goldExclude");
const { handlePriceItem } = require("./priceItem");
const { handleMarkPaidSelect } = require("./markPaid");

async function handleLootSelect(interaction) {
  // customId: loot-sel:{action}:{lootMsgId}[:{p2}:{p3}:{p4}]
  const withoutPrefix = interaction.customId.slice("loot-sel:".length);
  const parts = withoutPrefix.split(":");
  const action   = parts[0];
  const lootMsgId = parts[1];
  // p2..p4 are action-specific extras
  const p2 = parts[2];
  const p3 = parts[3];
  const p4 = parts[4];

  const panel = activeLootPanels[lootMsgId];
  if (!panel) {
    return interaction.reply({ content: "❌ Loot panel not found.", flags: MessageFlags.Ephemeral });
  }
  if (panel.closed) {
    return interaction.reply({ content: "🔒 This loot panel is closed.", flags: MessageFlags.Ephemeral });
  }

  switch (action) {
    case "seller":      return handleSellerSelect(interaction, panel);
    case "category":    return handleItemCategory(interaction, panel);
    case "item":        return handleItemSelect(interaction, panel);
    // Equipment: p2=itemKey, p3=source, p4=part (equip_class only)
    case "equip_part":  return handleEquipPart(interaction, panel, p2, p3);
    case "equip_class": return handleEquipClass(interaction, panel, p2, p3, p4);
    // Accessory: p2=itemKey, p3=source, p4=type (acc_subtype only)
    case "acc_type":    return handleAccType(interaction, panel, p2, p3);
    case "acc_subtype": return handleAccSubtype(interaction, panel, p2, p3, p4);
    // Gold: p2=source, p3=splitCount (gold_exclude only)
    case "gold_type":    return handleGoldType(interaction, panel, p2 || panel.source);
    case "gold_exclude": return handleGoldExclude(interaction, panel, p2, parseInt(p3, 10));
    case "price_item":  return handlePriceItem(interaction, panel);
    case "mark_paid":   return handleMarkPaidSelect(interaction, panel);
    default:
      return interaction.reply({ content: "❌ Unknown loot action.", flags: MessageFlags.Ephemeral });
  }
}

module.exports = { handleLootSelect };
