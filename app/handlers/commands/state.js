const { MessageFlags } = require("discord.js");
const { activeEvents, activeLootPanels } = require("../../state");
const { isCoLeader } = require("../../utils/coleader");
const { version } = require("../../version");

// active | stale (archived/locked) | gone (thread deleted) — same check /kirim-gaji uses.
async function threadStatus(client, threadId) {
  try {
    const thread = await client.channels.fetch(threadId);
    return thread.archived || thread.locked ? "stale" : "active";
  } catch {
    return "gone";
  }
}

const STATUS_ICON = { active: "🟢", stale: "🔒", gone: "❌" };

async function handleState(interaction) {
  if (!isCoLeader(interaction)) {
    return interaction.reply({ content: "⛔ Only Co-Leaders can use this.", flags: MessageFlags.Ephemeral });
  }

  const filter = interaction.options.getString("filter") || "all";
  const events = Object.values(activeEvents);
  const panels = Object.values(activeLootPanels);

  const statuses = await Promise.all(panels.map((p) => threadStatus(interaction.client, p.threadId)));
  let rows = panels.map((p, i) => ({ p, status: statuses[i] }));
  if (filter === "stale") rows = rows.filter((r) => r.status !== "active");

  const lines = [`📊 **State** \`v${version}\` — ${events.length} event(s), ${panels.length} loot panel(s)`];

  if (filter === "all" && events.length) {
    lines.push("\n**Active Events:**");
    for (const e of events) {
      const n = Object.keys(e.users || {}).length;
      lines.push(`• \`${e.messageId}\` — ${e.title} (${n}/${e.maxSlot})${e.locked ? " 🔒" : ""}`);
    }
  }

  if (rows.length) {
    lines.push(`\n**Loot Panels${filter === "stale" ? " (stale/gone only)" : ""}:**`);
    for (const { p, status } of rows) {
      lines.push(`• ${STATUS_ICON[status]} \`${p.lootMsgId}\` — ${p.eventTitle} (${p.members.length} members, ${p.items.length} items)`);
    }
  } else if (filter === "stale") {
    lines.push("\n✅ Tidak ada panel stale/gone.");
  }

  return interaction.reply({ content: lines.join("\n").slice(0, 2000), flags: MessageFlags.Ephemeral });
}

module.exports = { handleState };
