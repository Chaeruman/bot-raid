const { MessageFlags } = require("discord.js");
const { ack } = require("../../utils/ack");
const { checkCooldown } = require("../../utils/cooldown");
const { activeEvents, saveState } = require("../../state");
const { HOST_ONLY_BUTTONS, BOUNTY_TOGGLE } = require("../../constants");

const { handleSubRoleMenu } = require("./subRoleMenu");
const { handleRoleSelect } = require("./roleSelect");
const { handleMemoJobSelect } = require("./memoJobSelect");
const { handleCancelMyRole } = require("./cancelMyRole");
const { handleToggleLock } = require("./toggleLock");
const { handleCancelRun } = require("./cancelRun");
const { handleDoneRun } = require("./doneRun");
const { handleRemoveMember } = require("./removeMember");
const { handlePartyPingButton, handlePartyUp } = require("./partyPing");
const { handleLootButton } = require("./loot");
const { handleGabBudgetButton } = require("./gabBudget");
const { handleGabMarkPaidRec } = require("../commands/combinedPay");

// Buttons whose panel is not an entry in activeEvents. index.js reads the keys
// to know which ones to let through — every other button is answered with "this
// panel is no longer active" before it ever reaches here, so a handler added
// below without a key is dead on arrival. That is exactly how the bounty panel
// shipped broken: the router kept its own copy of this list, and only that copy
// was forgotten.
const EVENT_FREE = {
  "loot-btn:": (i) => handleLootButton(i),
  "bounty-panel:": (i) => require("../../bountyPanel").handlePanelButton(i),
  "bounty-thread:": (i) => require("../../bountyThread").handleCreateThread(i),
  "bounty-hunter:": (i) => require("./bountyHunter").handleHunterDecision(i),
  "bounty-img:": (i) => require("../../questImage").handleImageButton(i),
  "role-pick:": (i) => require("../../roleMenu").handleRolePick(i),
  "salary-btn:": (i) => require("../../salaryMenu").handleSalaryButton(i),
  "gab-budget:": (i) => handleGabBudgetButton(i),
  "gab-paid-rec:": (i) => handleGabMarkPaidRec(i),
};

async function handleButton(interaction) {
  for (const [prefix, handler] of Object.entries(EVENT_FREE))
    if (interaction.customId.startsWith(prefix)) return handler(interaction);

  const userId = interaction.user.id;
  const event = activeEvents[interaction.message.id];
  const onCooldown = checkCooldown(userId);

  if (onCooldown) {
    return ack(interaction, () => interaction.deferUpdate());
  }

  // Host-only check
  if (HOST_ONLY_BUTTONS.includes(interaction.customId) && userId !== event.hostId) {
    return interaction.reply({ content: "⛔ Only the host can do that.", flags: MessageFlags.Ephemeral });
  }

  // Role button logic
  if (interaction.customId.startsWith("role_")) {
    const slotKey = interaction.customId.replace("role_", "");
    const role = event.roles[slotKey];

    if (role) {
      if (event.locked) {
        return interaction.reply({ content: "🔒 The party is currently locked.", flags: MessageFlags.Ephemeral });
      }

      const alreadyInSlot = role.users.includes(userId);
      if (!alreadyInSlot && !event.stackRoles && role.users.length >= role.max) {
        return interaction.reply({ content: `❌ **${role.label || slotKey}** is already full!`, flags: MessageFlags.Ephemeral });
      }

      if (!event.users[userId] && Object.keys(event.users).length >= event.maxSlot) {
        return interaction.reply({ content: "❌ Party is full!", flags: MessageFlags.Ephemeral });
      }

      // Roles with subRoles show a class picker — they reply and return early
      if (role.subRoles?.length > 0) {
        return handleSubRoleMenu(interaction, event, slotKey, role);
      }

      // A bounty offer is a modal too, so it has to answer the interaction
      // before the deferUpdate below — and the seat is taken right after, so
      // dismissing the modal still leaves them in the party.
      if (event.poolKeys?.length) {
        const took = await require("../../bountyJoin")
          .offerBounty(interaction, event, { slotKey })
          .catch((err) => {
            console.error(`❌ offerBounty (${userId} → ${slotKey}):`, err);
            return false;
          });
        if (took) {
          const { seatUser } = require("./roleSelect");
          seatUser(event, userId, slotKey);
          saveState();
          return require("../../builders/content").updateMessage(interaction.message, event);
        }
      }
    }
  }

  // Memo job button logic (position auto-assigned, job is just a label)
  if (interaction.customId.startsWith("memojob_")) {
    if (event.locked) {
      return interaction.reply({ content: "🔒 The party is currently locked.", flags: MessageFlags.Ephemeral });
    }
    if (!event.users[userId] && Object.keys(event.users).length >= event.maxSlot) {
      return interaction.reply({ content: "❌ Party is full!", flags: MessageFlags.Ephemeral });
    }

    // A nest seat is "P1"; the ROLE is the job just pressed. Same modal, same
    // rule — and it has to be the first response, like every other modal here.
    if (event.poolKeys?.length) {
      const role = event.jobs?.[Number(interaction.customId.replace("memojob_", ""))];
      const took = await require("../../bountyJoin")
        .offerBounty(interaction, event, { role })
        .catch((err) => {
          console.error(`❌ offerBounty (${userId} → ${role}):`, err);
          return false;
        });
      if (took) return handleMemoJobSelect(interaction, event);
    }
  }

  // Bounty-only join replies with a menu — must be the first response.
  if (interaction.customId === "bounty-join") {
    return require("../../bountyJoin").handleBountyJoin(interaction, event);
  }

  // remove_member sends its own ephemeral reply — must NOT deferUpdate first
  if (interaction.customId === "remove_member") {
    return handleRemoveMember(interaction, event);
  }

  // party_ping shows a modal — must be the first response, no defer first
  if (interaction.customId === "party_ping") {
    return handlePartyPingButton(interaction, event);
  }

  // All other buttons: acknowledge first, then mutate state
  await ack(interaction, () => interaction.deferUpdate());

  switch (interaction.customId) {
    case "cancel_my_role": return handleCancelMyRole(interaction, event);
    case "toggle_lock":    return handleToggleLock(interaction, event);
    case "cancel_run":     return handleCancelRun(interaction, event);
    case BOUNTY_TOGGLE:    return require("../../bountyJoin").handleToggleBounty(interaction, event);
    case "done_run":       return handleDoneRun(interaction, event);
    case "party_up":       return handlePartyUp(interaction, event);
    default:
      if (interaction.customId.startsWith("role_")) return handleRoleSelect(interaction, event);
      if (interaction.customId.startsWith("memojob_")) return handleMemoJobSelect(interaction, event);
  }
}

// The prefixes, not the map: index.js only needs to know which buttons to let
// through, and deriving them here is what makes the two impossible to disagree.
module.exports = { handleButton, EVENT_FREE: Object.keys(EVENT_FREE) };
