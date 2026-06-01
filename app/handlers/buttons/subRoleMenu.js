const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");

async function handleSubRoleMenu(interaction, event, slotKey, role) {
  const label = role.label || slotKey;

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_subrole_${interaction.message.id}_${slotKey}`)
    .setPlaceholder("Select your class…")
    .addOptions(role.subRoles.map((sr) => ({ label: sr, value: sr })));

  return interaction.reply({
    content: `🎭 Which class are you playing as **${label}**?`,
    components: [new ActionRowBuilder().addComponents(selectMenu)],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleSubRoleMenu };
