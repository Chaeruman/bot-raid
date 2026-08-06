const { handleItemQtyModal } = require("./itemQty");
const { handleItemPriceModal } = require("./itemPrice");
const { handleGoldEntryModal } = require("./goldEntry");
const { handleSellerIgnModal } = require("./sellerIgn");
const { handleAddItemsModal } = require("./addItems");
const { handleResolveItemsModal } = require("./resolveItems");
const { handleSetPricesModal } = require("./setPrices");
const { handleGabBudgetModal } = require("./gabBudget");
const { handlePartyPingModal } = require("./partyPing");
const { handleBountyQuestModal } = require("./bountyQuest");

async function handleModal(interaction) {
  if (interaction.customId.startsWith("bounty-modal:quest:")) {
    return handleBountyQuestModal(interaction);
  }
  if (interaction.customId.startsWith("gab-budget-modal:")) {
    return handleGabBudgetModal(interaction);
  }
  if (interaction.customId.startsWith("party_ping_modal:")) {
    return handlePartyPingModal(interaction);
  }
  if (interaction.customId.startsWith("loot-modal:add_items:")) {
    return handleAddItemsModal(interaction);
  }
  if (interaction.customId.startsWith("loot-modal:set_prices:")) {
    return handleSetPricesModal(interaction);
  }
  if (interaction.customId.startsWith("loot-modal:resolve_items:")) {
    return handleResolveItemsModal(interaction);
  }
  if (interaction.customId.startsWith("loot-modal:item_qty:")) {
    return handleItemQtyModal(interaction);
  }
  if (interaction.customId.startsWith("loot-modal:item_price:")) {
    return handleItemPriceModal(interaction);
  }
  if (interaction.customId.startsWith("loot-modal:gold:")) {
    return handleGoldEntryModal(interaction);
  }
  if (interaction.customId.startsWith("loot-modal:seller_ign:")) {
    return handleSellerIgnModal(interaction);
  }
}

module.exports = { handleModal };
