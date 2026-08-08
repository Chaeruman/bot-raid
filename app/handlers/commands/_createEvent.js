const { MessageFlags } = require("discord.js");
const templates = require("../../templates");
const { activeEvents, saveState } = require("../../state");
const config = require("../../config");
const { updateMessage, buildSignupEmbed } = require("../../builders/content");

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

  // 8 players is a raid, 4 is a nest. Unset env vars keep the panel where the
  // command was typed, so nothing breaks before the channels exist.
  const targetId =
    template.maxSlot >= 8 ? config.publicRaidChannelId : config.publicNestChannelId;
  const target =
    (targetId && (await interaction.client.channels.fetch(targetId).catch(() => null))) ||
    interaction.channel;

  const msg = await target.send({ content: "Loading…" });
  event.messageId = msg.id;

  // A live preview in the command channel, so #public-raid stays panels-only
  // while people still see the party fill from where they talk.
  if (target.id !== interaction.channel.id) {
    event.panelUrl = msg.url;
    const preview = await interaction.channel
      .send({ embeds: [buildSignupEmbed(event, true)] })
      .catch(() => null);
    if (preview) {
      event.previewMessageId = preview.id;
      event.previewChannelId = preview.channelId;
    }
  }

  activeEvents[msg.id] = event;
  saveState();

  await updateMessage(msg, event);
  return interaction.editReply(
    `**${event.title}** started!` + (target.id !== interaction.channel.id ? ` → <#${target.id}>` : ""),
  );
}

module.exports = { createEvent };
