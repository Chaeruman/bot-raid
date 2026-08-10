const { MessageFlags } = require("discord.js");
const { activeLootPanels } = require("../../../state");
const { refreshLootPanel } = require("../../../builders/lootPanel");
const { handleSelectSeller } = require("./selectSeller");
const { handleAddItem, handleBrowseItem } = require("./addItem");
const { handleAddGold } = require("./addGold");
const { handleBonusGold } = require("./bonusGold");
const { handleSetPrice, handleSetPriceOne } = require("./setPrice");
const { handleMarkPaid } = require("./markPaid");
const { handleCloseLoot } = require("./closeLoot");
const { handleRemoveItem } = require("./removeItem");
const { handleRemoveGold } = require("./removeGold");
const { handleResolveItems } = require("./resolveItems");
const { handleAddMember } = require("./addMember");
const { handleRemoveMember } = require("./removeMember");

async function handleLootButton(interaction) {
  // customId: loot-btn:{action}:{lootMsgId}
  const withoutPrefix = interaction.customId.slice("loot-btn:".length);
  const colonIdx = withoutPrefix.indexOf(":");
  const action = withoutPrefix.slice(0, colonIdx);
  const lootMsgId = withoutPrefix.slice(colonIdx + 1);

  const panel = activeLootPanels[lootMsgId];
  if (!panel) {
    return interaction.reply({ content: "❌ Loot panel not found or already closed.", flags: MessageFlags.Ephemeral });
  }
  if (panel.closed) {
    return interaction.reply({ content: "🔒 This loot panel is closed.", flags: MessageFlags.Ephemeral });
  }

  switch (action) {
    case "select_seller": return handleSelectSeller(interaction, panel);
    case "add_item":      return handleAddItem(interaction, panel);
    case "browse_item":   return handleBrowseItem(interaction, panel);
    case "add_gold":      return handleAddGold(interaction, panel);
    case "bonus_gold":    return handleBonusGold(interaction, panel);
    case "set_price":     return handleSetPrice(interaction, panel);
    case "price_one":     return handleSetPriceOne(interaction, panel);
    case "remove_item":   return handleRemoveItem(interaction, panel);
    case "remove_gold":   return handleRemoveGold(interaction, panel);
    case "resolve_items": return handleResolveItems(interaction, panel);
    case "mark_paid":     return handleMarkPaid(interaction, panel);
    case "close":         return handleCloseLoot(interaction, panel);
    case "add_member":    return handleAddMember(interaction, panel);
    case "remove_member": return handleRemoveMember(interaction, panel);
    // Redraw from stored state. Changes nothing, so it needs no gate — its one
    // real use is after a deploy that changes the arithmetic, when the numbers
    // on screen were computed by code that no longer exists.
    case "refresh":
      await interaction.deferUpdate();
      return refreshLootPanel(interaction.client, panel);
    default:
      return interaction.reply({ content: "❌ Unknown loot action.", flags: MessageFlags.Ephemeral });
  }
}

module.exports = { handleLootButton };
