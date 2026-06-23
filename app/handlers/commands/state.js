const { MessageFlags } = require("discord.js");
const { activeEvents, activeLootPanels } = require("../../state");
const { isCoLeader } = require("../../utils/coleader");

async function handleState(interaction) {
  if (!isCoLeader(interaction)) {
    return interaction.reply({ content: "⛔ Only Co-Leaders can use this.", flags: MessageFlags.Ephemeral });
  }

  const events = Object.values(activeEvents);
  const panels = Object.values(activeLootPanels);

  const lines = [`📊 **State** — ${events.length} event(s), ${panels.length} loot panel(s)`];

  if (events.length) {
    lines.push("\n**Active Events:**");
    for (const e of events) {
      const n = Object.keys(e.users || {}).length;
      lines.push(`• \`${e.messageId}\` — ${e.title} (${n}/${e.maxSlot})${e.locked ? " 🔒" : ""}`);
    }
  }

  if (panels.length) {
    lines.push("\n**Active Loot Panels:**");
    for (const p of panels) {
      lines.push(`• \`${p.lootMsgId}\` — ${p.eventTitle} (${p.members.length} members, ${p.items.length} items)`);
    }
  }

  return interaction.reply({ content: lines.join("\n").slice(0, 2000), flags: MessageFlags.Ephemeral });
}

module.exports = { handleState };
