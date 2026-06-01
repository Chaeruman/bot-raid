const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");

async function handleRemoveMember(interaction, event) {
  const joinedUsers = Object.entries(event.users);
  if (joinedUsers.length === 0) {
    return interaction.reply({ content: "❌ No members to remove.", flags: MessageFlags.Ephemeral });
  }

  const options = joinedUsers.map(([uid, userInfo]) => ({
    label: userInfo.subRole || userInfo.slot,
    description: `ID: ${uid}`,
    value: uid,
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_remove_${interaction.message.id}`)
    .setPlaceholder("Select a member to remove…")
    .addOptions(options);

  return interaction.reply({
    content: "👤 Select the member to remove:",
    components: [new ActionRowBuilder().addComponents(selectMenu)],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleRemoveMember };
