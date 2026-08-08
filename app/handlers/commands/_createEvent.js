const { MessageFlags } = require("discord.js");
const templates = require("../../templates");
const { activeEvents, saveState } = require("../../state");
const { updateMessage } = require("../../builders/content");

async function createEvent(interaction, templateKey, labelOverride = null) {
  console.log(`[createEvent] called with templateKey=${templateKey}`);
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (err) {
    if (err.code === 40060) return;
    throw err;
  }

  const template = templates[templateKey];
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

  const closed =
    !!template.poolKeys && interaction.options?.getBoolean?.("closed_to_bounty") === true;

  const label = labelOverride || template.label;

  const event = {
    messageId: null,
    createdAt: Date.now(),
    hostId: interaction.user.id,
    label,
    title: `${label} — ${dateStr} ${timeStr} WIB`,
    maxSlot: template.maxSlot,
    noThread: template.noThread || false,
    forumTagKey: template.forumTagKey || null,
    hcGoldSplit: template.hcGoldSplit !== undefined ? template.hcGoldSplit : false,
    subruns: template.subruns || null,
    poolKeys: template.poolKeys || null, // bounty variants this run clears
    // Bounty-only parties drop the per-role caps: the character you bring
    // decides the slot, and a quest holder is never turned away for "FU full".
    closedToBounty: closed,
    stackRoles: closed,
    jobs: template.jobs || null,
    roles,
    users: {},
    locked: false,
  };

  const msg = await interaction.channel.send({ content: "Loading…" });
  event.messageId = msg.id;
  activeEvents[msg.id] = event;
  saveState();

  await updateMessage(msg, event);
  return interaction.editReply(`**${event.title}** started!`);
}

module.exports = { createEvent };
