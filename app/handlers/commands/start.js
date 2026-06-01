const { MessageFlags } = require("discord.js");
const templates = require("../../templates");
const { activeEvents } = require("../../state");
const { updateMessage } = require("../../builders/content");

async function handleStart(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (err) {
    if (err.code === 40060) return; // Another instance already handled this
    throw err;
  }

  const eventName = interaction.options.getString("event");
  const template = templates[eventName];

  if (!template) {
    return interaction.editReply("❌ Event not found.");
  }

  const roles = {};
  for (const r in template.roles) {
    roles[r] = { ...template.roles[r], users: [] };
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  const dateStr = now.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  const event = {
    messageId: null,
    hostId: interaction.user.id,
    label: template.label,
    title: `${template.label} — ${dateStr} ${timeStr} WIB`,
    maxSlot: template.maxSlot,
    noThread: template.noThread || false,
    forumTagKey: template.forumTagKey || null,
    hcGoldSplit: template.hcGoldSplit !== undefined ? template.hcGoldSplit : false,
    roles,
    users: {},
    locked: false,
  };

  const msg = await interaction.channel.send({ content: "Loading…" });
  event.messageId = msg.id;
  activeEvents[msg.id] = event;

  await updateMessage(msg, event);
  return interaction.editReply(`**${event.title}** started!`);
}

module.exports = { handleStart };
