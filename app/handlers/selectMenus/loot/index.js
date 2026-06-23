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
const { handleAddMemberSelect } = require("./addMember");
const { handleRemoveMemberSelect } = require("./removeMember");
const { handleRemoveItemSelect } = require("./removeItem");
const { handleRemoveGoldSelect } = require("./removeGold");

async function handleLootSelect(interaction) {
  // customId: loot-sel:{action}:{lootMsgId}[:{p2}:{p3}]
  const withoutPrefix = interaction.customId.slice("loot-sel:".length);
  const parts = withoutPrefix.split(":");
  const action    = parts[0];
  const lootMsgId = parts[1];
  const p2 = parts[2];
  const p3 = parts[3];

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
    // Equipment: p2=itemKey, p3=part (equip_class only)
    case "equip_part":  return handleEquipPart(interaction, panel, p2);
    case "equip_class": return handleEquipClass(interaction, panel, p2, p3);
    // Accessory: p2=itemKey, p3=type (acc_subtype only)
    case "acc_type":    return handleAccType(interaction, panel, p2);
    case "acc_subtype": return handleAccSubtype(interaction, panel, p2, p3);
    // Gold: p2=splitCount (gold_exclude only)
    case "gold_type":    return handleGoldType(interaction, panel);
    case "gold_exclude": return handleGoldExclude(interaction, panel, parseInt(p2, 10));
    case "price_item":  return handlePriceItem(interaction, panel);
    case "mark_paid":      return handleMarkPaidSelect(interaction, panel);
    case "add_member":     return handleAddMemberSelect(interaction, panel);
    case "remove_member":  return handleRemoveMemberSelect(interaction, panel);
    case "remove_item":    return handleRemoveItemSelect(interaction, panel);
    case "remove_gold":    return handleRemoveGoldSelect(interaction, panel);
    default:
      return interaction.reply({ content: "❌ Unknown loot action.", flags: MessageFlags.Ephemeral });
  }
}

module.exports = { handleLootSelect };
