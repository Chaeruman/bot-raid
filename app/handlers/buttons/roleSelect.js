const { updateMessage } = require("../../builders/content");
const { isMTDestroyer } = require("../../builders/buttons");
const { saveState } = require("../../state");

async function handleRoleSelect(interaction, event) {
  const slotKey = interaction.customId.replace("role_", "");
  const role = event.roles[slotKey];
  if (!role) return;

  const userId = interaction.user.id;

  // Remove from current slot if switching
  const currentUser = event.users[userId];
  if (currentUser) {
    const currentRole = event.roles[currentUser.slot];
    if (currentRole) {
      currentRole.users = currentRole.users.filter((id) => id !== userId);
    }
  }

  // MC subRole is determined automatically by MT state
  let subRole = null;
  if (slotKey === "MC") {
    subRole = isMTDestroyer(event) ? "Barba" : "MC";
  }

  role.users.push(userId);
  event.users[userId] = { slot: slotKey, subRole };
  saveState();

  return updateMessage(interaction.message, event);
}

module.exports = { handleRoleSelect };
