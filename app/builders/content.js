const { EmbedBuilder } = require("discord.js");
const { createButtons } = require("./buttons");
const { MAX_SHARE_STACK } = require("../data/bounty");

// Roles are printed as a padded code-span column so the names line up down the
// panel — with nine roles, a ragged left edge is what makes it hard to read.
// Width comes from the event's own roles, so a 4-slot nest doesn't inherit
// "Ice Stacker"'s padding.
function buildRoleLines(event) {
  const shown = Object.entries(event.roles).filter(
    ([, role]) => role.users.length > 0 || !role.hideIfEmpty,
  );
  const width = Math.max(0, ...shown.map(([slotKey, role]) => (role.label || slotKey).length));

  let content = "";
  for (const [slotKey, role] of shown) {
    const count = role.users.length;
    // MC slot: the subRole IS the display name (Barba / MC)
    const label =
      (role.subRoleAsLabel && count && event.users[role.users[0]]?.subRole) ||
      role.label ||
      slotKey;

    const who = count
      ? role.users
          .map((uid) => {
            const subRole = event.users[uid]?.subRole;
            return subRole && !role.subRoleAsLabel ? `<@${uid}> (${subRole})` : `<@${uid}>`;
          })
          .join(", ")
      : "—";

    const slotText = !event.stackRoles && count && role.max > 1 ? ` (${count}/${role.max})` : "";
    content += `\`${label.padEnd(width)}\` ${who}${slotText}\n`;
  }

  return content;
}

function buildSignupEmbed(event, isPreview = false) {
  const totalUsers = Object.keys(event.users).length;

  const desc = [];
  if (event.subruns) desc.push(`📍 ${event.subruns.join(" > ")}`);
  desc.push(`**Host:** <@${event.hostId}>`);
  if (event.poolKeys?.length) {
    // Quests stack, not people: one character can bring two. One cap for the
    // whole run — the 6 is a weekly claim budget, and a marathon's two clears
    // spend from the same one.
    const cap = Math.min(event.maxSlot, MAX_SHARE_STACK);
    const stacked = Object.values(event.users).reduce((n, u) => n + (u.bountyQuests || 0), 0);
    desc.push(
      `🎯 **Stack ${Math.min(stacked, cap)}/${cap}**` +
        (event.closedToBounty ? " · khusus bounty" : ""),
    );
  }
  if (event.locked) desc.push(`🔒 **Party is LOCKED**`);
  else if (totalUsers >= event.maxSlot) desc.push(`✅ **Party FULL**`);
  desc.push("");
  desc.push(buildRoleLines(event).trim());
  // Only the preview carries this — the panel itself is what the link points at.
  if (isPreview && event.panelUrl) desc.push("", `👉 **[Join di sini](${event.panelUrl})**`);

  const color = event.locked
    ? 0xe74c3c
    : totalUsers >= event.maxSlot
      ? 0x2ecc71
      : 0x5865f2;

  return new EmbedBuilder()
    .setTitle(`${event.title} (${totalUsers}/${event.maxSlot})`)
    .setColor(color)
    .setDescription(desc.join("\n"));
}

// The panel lives in #public-raid / #public-nest; the preview sits in the
// channel the command was typed in. Both are refreshed here — updateMessage is
// called from ~8 handlers, so putting the sync anywhere else would let one of
// them forget and drift.
async function updatePreview(message, event) {
  if (!event.previewMessageId) return;
  try {
    const channel = await message.client.channels.fetch(event.previewChannelId);
    const preview = await channel.messages.fetch(event.previewMessageId);
    await preview.edit({ content: "", embeds: [buildSignupEmbed(event, true)], components: [] });
  } catch {
    // Deleted, or the bot lost access. The real panel must never fall over for
    // its own shadow, so forget the preview and carry on.
    event.previewMessageId = null;
  }
}

// The run is over, so the preview stops being a live thing. It keeps the final
// roster and loses the join link — the panel it pointed at is closed.
async function closePreview(message, event, note) {
  if (!event.previewMessageId) return;
  try {
    const channel = await message.client.channels.fetch(event.previewChannelId);
    const preview = await channel.messages.fetch(event.previewMessageId);
    await preview.edit({ content: note, embeds: [], components: [] });
  } catch {
    /* already gone — nothing to close */
  }
  event.previewMessageId = null;
}

async function updateMessage(message, event) {
  await message.edit({
    content: "",
    embeds: [buildSignupEmbed(event)],
    components: createButtons(event, event.hostId),
  });
  await updatePreview(message, event);
}

function buildThreadTitle(event) {
  const now = new Date();
  const day = now.toLocaleDateString("id-ID", { day: "2-digit", timeZone: "Asia/Jakarta" });
  const month = now.toLocaleDateString("en-US", { month: "short", timeZone: "Asia/Jakarta" });
  return `${event.label} (seller) - ${day} ${month}`;
}

function buildThreadContent(event) {
  let content = `**${event.title}**\n\n`;
  content += buildRoleLines(event);
  return content;
}

module.exports = { updateMessage, updatePreview, closePreview, buildSignupEmbed, buildThreadTitle, buildThreadContent };
