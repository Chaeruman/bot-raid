const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");

async function handleAddGold(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can add gold.", flags: MessageFlags.Ephemeral });
  }

  const source = panel.source;

  if (panel.hcGoldSplit === "mixed") {
    // Marathon: ask whether this gold is from an HC or normal run
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`loot-sel:gold_type:${panel.lootMsgId}:${source}`)
        .setPlaceholder("Select gold split type")
        .addOptions([
          { label: "HC (÷7)", value: "7", description: "Gold from HC run — split among 7 members" },
          { label: "Normal (÷8)", value: "8", description: "Gold from normal run — split among 8 members" },
        ]),
    );

    return interaction.reply({
      content: "💰 **Add Gold** — select split type:",
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }

  // Single raid: split count is fixed
  const splitCount = panel.hcGoldSplit ? 7 : 8;
  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:gold:${panel.lootMsgId}:${splitCount}:${source}`)
    .setTitle(`Add Gold (÷${splitCount})`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("amount")
        .setLabel(`Gold amount (split ÷${splitCount})`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 100000")
        .setRequired(true),
    ),
  );

  return interaction.showModal(modal);
}

module.exports = { handleAddGold };
