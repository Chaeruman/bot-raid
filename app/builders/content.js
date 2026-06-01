const { createButtons } = require("./buttons");

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

    const slotText = role.max > 1 ? ` (${count}/${role.max})` : "";

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

async function updateMessage(message, event) {
  const totalUsers = Object.keys(event.users).length;

  let content = `**${event.title}** (${totalUsers}/${event.maxSlot})\n`;
  content += `Host: <@${event.hostId}>\n`;

  if (event.locked) {
    content += `🔒 **Party is LOCKED**\n`;
  } else if (totalUsers >= event.maxSlot) {
    content += `✅ **Party FULL**\n`;
  }

  content += `\n`;
  content += buildRoleLines(event);

  await message.edit({
    content,
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

module.exports = { updateMessage, buildThreadTitle, buildThreadContent };
