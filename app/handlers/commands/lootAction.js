const { MessageFlags } = require("discord.js");
const { activeLootPanels } = require("../../state");
const { handleSelectSeller } = require("../buttons/loot/selectSeller");
const { handleAddItem, handleBrowseItem } = require("../buttons/loot/addItem");
const { handleRemoveItem } = require("../buttons/loot/removeItem");
const { handleSetPrice } = require("../buttons/loot/setPrice");
const { handleAddGold } = require("../buttons/loot/addGold");
const { handleRemoveGold } = require("../buttons/loot/removeGold");
const { handleMarkPaid } = require("../buttons/loot/markPaid");
const { handleAddMember } = require("../buttons/loot/addMember");
const { handleRemoveMember } = require("../buttons/loot/removeMember");

// Each handler self-guards (seller- or host-only) and replies/opens its own modal.
const ACTIONS = {
  seller: handleSelectSeller,
  "type-items": handleAddItem,
  browse: handleBrowseItem,
  "remove-item": handleRemoveItem,
  "set-price": handleSetPrice,
  "add-gold": handleAddGold,
  "remove-gold": handleRemoveGold,
  "mark-paid": handleMarkPaid,
  "add-member": handleAddMember,
  "remove-member": handleRemoveMember,
};

async function handleLootAction(interaction) {
  const id = interaction.options.getString("id").trim();
  const action = interaction.options.getString("action");

  const panel = activeLootPanels[id];
  if (!panel) {
    return interaction.reply({ content: "❌ No active loot panel with that ID (see the panel footer).", flags: MessageFlags.Ephemeral });
  }
  if (panel.closed) {
    return interaction.reply({ content: "🔒 That loot panel is closed.", flags: MessageFlags.Ephemeral });
  }

  const handler = ACTIONS[action];
  if (!handler) {
    return interaction.reply({ content: "❌ Unknown action.", flags: MessageFlags.Ephemeral });
  }
  return handler(interaction, panel);
}

module.exports = { handleLootAction };
