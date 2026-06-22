const { updateMessage } = require("../../builders/content");
const { saveState } = require("../../state");

async function handleCancelMyRole(interaction, event) {
  const userId = interaction.user.id;
  const currentUser = event.users[userId];
  if (!currentUser) return;

  const currentRole = event.roles[currentUser.slot];
  if (currentRole) {
    currentRole.users = currentRole.users.filter((id) => id !== userId);
  }
  delete event.users[userId];
  saveState();

  return updateMessage(interaction.message, event);
}

module.exports = { handleCancelMyRole };
