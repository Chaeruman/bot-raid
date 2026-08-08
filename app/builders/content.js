const { EmbedBuilder } = require("discord.js");
const { createButtons } = require("./buttons");
const { MAX_SHARE_STACK } = require("../data/bounty");
const { BY_POOL_KEY } = require("../bounty");

function buildRoleLines(event) {
  let content = "";

  for (const [slotKey, role] of Object.entries(event.roles)) {
    const count = role.users.length;

    if (count === 0 && role.hideIfEmpty) continue;

    const baseLabel = role.label || slotKey;

    if (count === 0) {
      content += `**${baseLabel}** — *(empty)*\n`;
      continue;
    }

    const slotText = event.stackRoles ? "" : role.max > 1 ? ` (${count}/${role.max})` : "";

    if (role.subRoleAsLabel) {
      // MC slot: the subRole IS the display name (Barba / MC)
      const displayLabel = event.users[role.users[0]]?.subRole || baseLabel;
      content += `**${displayLabel}** — <@${role.users[0]}>\n`;
    } else {
      const mentions = role.users
        .map((uid) => {
          const subRole = event.users[uid]?.subRole;
          return subRole ? `<@${uid}> (${subRole})` : `<@${uid}>`;
        })
        .join(", ");
      content += `**${baseLabel}**${slotText} — ${mentions}\n`;
    }
  }

  return content;
}

function buildSignupEmbed(event) {
  const totalUsers = Object.keys(event.users).length;

  const desc = [];
  if (event.subruns) desc.push(`📍 ${event.subruns.join(" > ")}`);
  desc.push(`**Host:** <@${event.hostId}>`);
  if (event.poolKeys?.length) {
    // Quests stack, not people: one character can bring two. Past the cap a
    // quest is shared with nobody, so the panel shows the ceiling.
    // Per variant: a marathon is two clears, so each gets its own stack.
    const cap = Math.min(event.maxSlot, MAX_SHARE_STACK);
    const per = event.poolKeys.map((p) => ({
      p,
      n: Object.values(event.users).reduce((n, u) => n + ((u.bountyQuests || {})[p] || 0), 0),
    }));
    const body =
      per.length === 1
        ? `${Math.min(per[0].n, cap)}/${cap}`
        : per.map((x) => `${BY_POOL_KEY.get(x.p)?.label || x.p} ${Math.min(x.n, cap)}/${cap}`).join(" · ");
    desc.push(`🎯 **Stack** ${body}` + (event.closedToBounty ? " · khusus bounty" : ""));
  }
  if (event.locked) desc.push(`🔒 **Party is LOCKED**`);
  else if (totalUsers >= event.maxSlot) desc.push(`✅ **Party FULL**`);
  desc.push("");
  desc.push(buildRoleLines(event).trim());

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

async function updateMessage(message, event) {
  await message.edit({
    content: "",
    embeds: [buildSignupEmbed(event)],
    components: createButtons(event, event.hostId),
  });
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

module.exports = { updateMessage, buildSignupEmbed, buildThreadTitle, buildThreadContent };
