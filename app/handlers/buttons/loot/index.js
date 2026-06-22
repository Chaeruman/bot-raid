const { MessageFlags } = require("discord.js");
const { activeLootPanels } = require("../../../state");
const { handleSelectSeller } = require("./selectSeller");
const { handleAddItem } = require("./addItem");
const { handleAddGold } = require("./addGold");
const { handleSetPrice } = require("./setPrice");
const { handleMarkPaid } = require("./markPaid");
const { handleCloseLoot } = require("./closeLoot");
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
    case "add_gold":      return handleAddGold(interaction, panel);
    case "set_price":     return handleSetPrice(interaction, panel);
    case "mark_paid":     return handleMarkPaid(interaction, panel);
    case "close":         return handleCloseLoot(interaction, panel);
    case "add_member":    return handleAddMember(interaction, panel);
    case "remove_member": return handleRemoveMember(interaction, panel);
    default:
      return interaction.reply({ content: "❌ Unknown loot action.", flags: MessageFlags.Ephemeral });
  }
}

module.exports = { handleLootButton };
