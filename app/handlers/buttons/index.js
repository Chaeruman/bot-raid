const { MessageFlags } = require("discord.js");
const { ack } = require("../../utils/ack");
const { checkCooldown } = require("../../utils/cooldown");
const { activeEvents } = require("../../state");
const { HOST_ONLY_BUTTONS } = require("../../constants");

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

async function handleButton(interaction) {
  // Loot panel buttons are independent of activeEvents — handle them first
  if (interaction.customId.startsWith("loot-btn:")) {
    return handleLootButton(interaction);
  }
  if (interaction.customId.startsWith("gab-budget:")) {
    return handleGabBudgetButton(interaction);
  }
  if (interaction.customId.startsWith("gab-paid-rec:")) {
    return handleGabMarkPaidRec(interaction);
  }
  // Board buttons live on a pinned message, not an activeEvent — and they open a
  // modal, so they must not be deferred first.
  if (interaction.customId.startsWith("bounty-card:")) {
    return require("../commands/bounty").handleCardButton(interaction);
  }

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
      if (!alreadyInSlot && role.users.length >= role.max) {
        return interaction.reply({ content: `❌ **${role.label || slotKey}** is already full!`, flags: MessageFlags.Ephemeral });
      }

      if (!event.users[userId] && Object.keys(event.users).length >= event.maxSlot) {
        return interaction.reply({ content: "❌ Party is full!", flags: MessageFlags.Ephemeral });
      }

      // Roles with subRoles show a class picker — they reply and return early
      if (role.subRoles?.length > 0) {
        return handleSubRoleMenu(interaction, event, slotKey, role);
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
    case "done_run":       return handleDoneRun(interaction, event);
    case "party_up":       return handlePartyUp(interaction, event);
    default:
      if (interaction.customId.startsWith("role_")) return handleRoleSelect(interaction, event);
      if (interaction.customId.startsWith("memojob_")) return handleMemoJobSelect(interaction, event);
  }
}

module.exports = { handleButton };
