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

  // On a bounty-aware panel, the character comes first: clicking a role picks a
  // ROLE, and when the joiner holds quests on more than one character the bot
  // must not seat them under a name it guessed. The picker seats them instead.
  if (event.poolKeys?.length) {
    // Never swallow this. A failure here seats the player with no bounty
    // recorded, which reads as "you have no quest for this nest" — a wrong
    // answer that looks like a correct one.
    const asked = await require("../../bountyJoin")
      .askBeforeSeat(interaction, event, slotKey)
      .catch((err) => {
        console.error(`❌ askBeforeSeat (${interaction.user.id} → ${slotKey}):`, err);
        return false;
      });
    if (asked) return;
  }

  seatUser(event, interaction.user.id, slotKey);
  saveState();
  return updateMessage(interaction.message, event);
}

module.exports = { handleRoleSelect, seatUser };
