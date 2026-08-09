const { updateMessage } = require("../../builders/content");
const { isMTDestroyer } = require("../../builders/buttons");
const { saveState } = require("../../state");

// Put a user in a slot, moving them out of their current one. Exported because
// the bounty character picker seats people too — it just does it after asking
// which character they brought (see bountyJoin.js).
function seatUser(event, userId, slotKey) {
  const role = event.roles[slotKey];
  if (!role) return null;

  const current = event.users[userId];
  if (current) {
    const currentRole = event.roles[current.slot];
    if (currentRole) currentRole.users = currentRole.users.filter((id) => id !== userId);
  }

  // MC subRole is determined automatically by MT state
  const subRole = slotKey === "MC" ? (isMTDestroyer(event) ? "Barba" : "MC") : null;

  role.users.push(userId);
  event.users[userId] = { slot: slotKey, subRole, ...(current?.bountyChar ? { bountyChar: current.bountyChar } : {}) };
  return event.users[userId];
}

async function handleRoleSelect(interaction, event) {
  const slotKey = interaction.customId.replace("role_", "");
  if (!event.roles[slotKey]) return;

  // Just the seat. On a bounty panel the offer is a modal, so it answered the
  // interaction upstream and seated the player itself — this path only runs
  // when there was nothing to offer.
  seatUser(event, interaction.user.id, slotKey);
  saveState();
  return updateMessage(interaction.message, event);
}

module.exports = { handleRoleSelect, seatUser };
