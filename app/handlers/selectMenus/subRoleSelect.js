const { MessageFlags } = require("discord.js");
const { ack } = require("../../utils/ack");
const { activeEvents, saveState } = require("../../state");
const { updateMessage } = require("../../builders/content");

async function handleSubRoleSelect(interaction) {
  // customId: select_subrole_{messageId}_{slotKey}
  const withoutPrefix = interaction.customId.replace("select_subrole_", "");
  const sep = withoutPrefix.indexOf("_");
  const messageId = withoutPrefix.slice(0, sep);
  const slotKey = withoutPrefix.slice(sep + 1);

  const event = activeEvents[messageId];
  if (!event) {
    return ack(interaction, () =>
      interaction.reply({ content: "❌ Event not found.", flags: MessageFlags.Ephemeral }),
    );
  }

  await ack(interaction, () => interaction.deferUpdate());

  const userId = interaction.user.id;
  const subRole = interaction.values[0];
  const role = event.roles[slotKey];
  if (!role) return interaction.editReply({ content: "❌ Invalid slot.", components: [] });

  const currentUser = event.users[userId];

  // Re-validate in case party filled up while the picker was open
  const alreadyInSlot = role.users.includes(userId);
  if (!alreadyInSlot && role.users.length >= role.max) {
    return interaction.editReply({ content: `❌ **${role.label || slotKey}** just filled up!`, components: [] });
  }
  if (!currentUser && Object.keys(event.users).length >= event.maxSlot) {
    return interaction.editReply({ content: "❌ Party just filled up!", components: [] });
  }

  // Remove from current slot
  if (currentUser) {
    const currentRole = event.roles[currentUser.slot];
    if (currentRole) {
      currentRole.users = currentRole.users.filter((id) => id !== userId);
    }
  }

  // Remove from target slot if already there (subRole change)
  if (alreadyInSlot) {
    role.users = role.users.filter((id) => id !== userId);
  }

  role.users.push(userId);
  event.users[userId] = { slot: slotKey, subRole };
  saveState();

  const signupMessage = await interaction.channel.messages.fetch(messageId);
  await updateMessage(signupMessage, event);

  return interaction.editReply({ content: `✅ Joined as **${subRole}**!`, components: [] });
}

module.exports = { handleSubRoleSelect };
