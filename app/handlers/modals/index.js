const { handleItemQtyModal } = require("./itemQty");
const { handleItemPriceModal } = require("./itemPrice");
const { handleGoldEntryModal } = require("./goldEntry");

async function handleModal(interaction) {
  if (interaction.customId.startsWith("loot-modal:item_qty:")) {
    return handleItemQtyModal(interaction);
  }
  if (interaction.customId.startsWith("loot-modal:item_price:")) {
    return handleItemPriceModal(interaction);
  }
  if (interaction.customId.startsWith("loot-modal:gold:")) {
    return handleGoldEntryModal(interaction);
  }
}

module.exports = { handleModal };
