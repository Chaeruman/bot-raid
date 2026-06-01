const { MessageFlags } = require("discord.js");
const { ack } = require("../../utils/ack");
const { activeEvents } = require("../../state");
const { updateMessage } = require("../../builders/content");

async function handleRemoveMemberSelect(interaction) {
  const messageId = interaction.customId.replace("select_remove_", "");
  const event = activeEvents[messageId];

  if (!event) {
    return ack(interaction, () =>
      interaction.reply({ content: "❌ Event not found.", flags: MessageFlags.Ephemeral }),
    );
  }

  if (interaction.user.id !== event.hostId) {
    return ack(interaction, () =>
      interaction.reply({ content: "⛔ Only the host can remove members.", flags: MessageFlags.Ephemeral }),
    );
  }

  await ack(interaction, () => interaction.deferUpdate());

  const targetId = interaction.values[0];
  const targetUser = event.users[targetId];
  if (!targetUser) return;

  const targetRole = event.roles[targetUser.slot];
  if (targetRole) {
    targetRole.users = targetRole.users.filter((id) => id !== targetId);
  }
  delete event.users[targetId];

  const signupMessage = await interaction.channel.messages.fetch(messageId);
  await updateMessage(signupMessage, event);

  return interaction.editReply({
    content: `✅ <@${targetId}> has been removed from the party.`,
    components: [],
  });
}

module.exports = { handleRemoveMemberSelect };
