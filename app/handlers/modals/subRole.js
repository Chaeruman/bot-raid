const { MessageFlags } = require("discord.js");
const { activeEvents, saveState } = require("../../state");
const { updateMessage } = require("../../builders/content");
const { SUBROLE_MODAL } = require("../buttons/subRoleMenu");

const refuse = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral });

async function handleSubRoleModal(interaction) {
  const [messageId, slotKey] = interaction.customId.slice(SUBROLE_MODAL.length).split(":");
  const event = activeEvents[messageId];
  if (!event) return refuse(interaction, "❌ Panel ini sudah tidak aktif.");

  const subRole = interaction.fields.getStringSelectValues("class")[0];
  const role = event.roles[slotKey];
  if (!role) return refuse(interaction, "❌ Slot itu sudah tidak ada.");

  const userId = interaction.user.id;
  const currentUser = event.users[userId];
  const alreadyInSlot = role.users.includes(userId);

  // Re-checked here, not just before the picker opened: the party can fill up
  // while someone is deciding, and seating them anyway would put a ninth person
  // in an eight-person run.
  if (!alreadyInSlot && !event.stackRoles && role.users.length >= role.max)
    return refuse(interaction, `❌ **${role.label || slotKey}** just filled up!`);
  if (!currentUser && Object.keys(event.users).length >= event.maxSlot)
    return refuse(interaction, "❌ Party just filled up!");

  if (currentUser) {
    const from = event.roles[currentUser.slot];
    if (from) from.users = from.users.filter((id) => id !== userId);
  }
  if (alreadyInSlot) role.users = role.users.filter((id) => id !== userId);

  role.users.push(userId);
  event.users[userId] = { ...currentUser, slot: slotKey, subRole };
  saveState();

  // Nothing to reply with: the panel is right there and now shows the seat.
  await interaction.deferUpdate();
  const panel = await interaction.channel.messages.fetch(messageId).catch(() => null);
  if (panel) await updateMessage(panel, event);
}

module.exports = { handleSubRoleModal };
