const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");

async function handleSelectSeller(interaction, panel) {
  if (interaction.user.id !== panel.hostId) {
    return interaction.reply({ content: "⛔ Only the host can select the seller.", flags: MessageFlags.Ephemeral });
  }

  // Fetch guild member display names for the option labels
  const options = await Promise.all(
    panel.members.map(async (uid) => {
      let label = uid;
      try {
        const member = await interaction.guild.members.fetch(uid);
        label = member.displayName;
      } catch {
        // fallback to ID if fetch fails
      }
      return {
        label: label.slice(0, 100),
        value: uid,
        description: uid === panel.sellerId ? "✅ Current seller" : "Party member",
        default: uid === panel.sellerId,
      };
    }),
  );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:seller:${panel.lootMsgId}`)
      .setPlaceholder("Select a seller")
      .addOptions(options),
  );

  await interaction.reply({
    content: "👤 Select the seller for this loot panel:",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleSelectSeller };
