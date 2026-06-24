const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { saveState } = require("../../../state");

async function handleSellerSelect(interaction, panel) {
  panel.sellerId = interaction.values[0];
  saveState();

  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:seller_ign:${panel.lootMsgId}`)
    .setTitle("Seller In-Game Nickname");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("ign")
        .setLabel("Seller's in-game nickname")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. Nekonin")
        .setValue(panel.sellerIgn || "")
        .setMaxLength(50)
        .setRequired(true),
    ),
  );

  return interaction.showModal(modal);
}

module.exports = { handleSellerSelect };
