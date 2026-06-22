const { ActionRowBuilder, UserSelectMenuBuilder, MessageFlags } = require("discord.js");
const { setPendingEphemeral } = require("../../../state");

async function handleAddMember(interaction, panel) {
  if (interaction.user.id !== panel.hostId) {
    return interaction.reply({ content: "⛔ Only the host can manage members.", flags: MessageFlags.Ephemeral });
  }

  const row = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`loot-sel:add_member:${panel.lootMsgId}`)
      .setPlaceholder("Search for a member to add…"),
  );

  await interaction.reply({
    content: "👥 **Add Member** — search and select:",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
  setPendingEphemeral(panel.lootMsgId, interaction.user.id, interaction);
}

module.exports = { handleAddMember };
