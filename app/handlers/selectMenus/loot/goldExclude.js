const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

async function showGoldExcludeSelect(interaction, panel, source, splitCount) {
  const { ActionRowBuilder: AR, StringSelectMenuBuilder } = require("discord.js");

  const options = await Promise.all(
    panel.members.map(async (uid) => {
      let label = uid;
      try {
        const member = await interaction.guild.members.fetch(uid);
        label = member.displayName;
      } catch { /* fallback to ID */ }
      return { label: label.slice(0, 100), value: uid };
    }),
  );

  const row = new AR().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:gold_exclude:${panel.lootMsgId}:${source}:${splitCount}`)
      .setPlaceholder("Pilih member yang tidak dapat gold")
      .addOptions(options),
  );

  return interaction.reply({
    content: `Siapa yang tidak dapat bagian gold ini?`,
    components: [row],
    flags: 64, // Ephemeral
  });
}

async function handleGoldExclude(interaction, panel, source, splitCount) {
  const excludedUserId = interaction.values[0];

  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:gold:${panel.lootMsgId}:${splitCount}:${source}:${excludedUserId}`)
    .setTitle(`Add Gold (÷${splitCount})`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("amount")
        .setLabel(`Jumlah gold (dibagi ${splitCount} orang)`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 100000")
        .setRequired(true),
    ),
  );

  return interaction.showModal(modal);
}

module.exports = { showGoldExcludeSelect, handleGoldExclude };
