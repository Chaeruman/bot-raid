const { ActionRowBuilder, UserSelectMenuBuilder, MessageFlags } = require("discord.js");

function buildAddMemberRow(panel) {
  return new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`loot-sel:add_member:${panel.lootMsgId}`)
      .setPlaceholder("Search & select member(s) to add…")
      .setMinValues(1)
      .setMaxValues(25),
  );
}

async function handleAddMember(interaction, panel) {
  if (interaction.user.id !== panel.hostId) {
    return interaction.reply({ content: "⛔ Only the host can manage members.", flags: MessageFlags.Ephemeral });
  }

  await interaction.reply({
    content: "👥 **Add Member** — search and select (you can add several):",
    components: [buildAddMemberRow(panel)],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleAddMember, buildAddMemberRow };
