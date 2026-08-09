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

  // Seat first, always. Clicking a role is a complete answer on its own — the
  // bounty is a separate question, asked afterwards and safe to ignore.
  //
  // It used to gate the seat on that question and, with a single candidate,
  // answer it for you: clicking SM/DA with one bounty character on file
  // attached that character to the seat whatever role it actually plays.
  seatUser(event, interaction.user.id, slotKey);
  saveState();
  await updateMessage(interaction.message, event);

  if (!event.poolKeys?.length) return;
  // Never swallow this. A failure here leaves someone seated with no bounty
  // recorded, which reads as "you have no quest for this nest" — a wrong answer
  // that looks like a correct one.
  return require("../../bountyJoin")
    .offerBounty(interaction, event, slotKey)
    .catch((err) => console.error(`❌ offerBounty (${interaction.user.id} → ${slotKey}):`, err));
}

module.exports = { handleRoleSelect, seatUser };
