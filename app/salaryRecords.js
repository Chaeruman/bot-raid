// Top-5 highest total salary paid out from a single loot panel (one entry
// per panel, not per member) — e.g. "Marathon GDN blabla - seller - amount".
// Checked only when a panel fully closes, using the amounts already computed
// for that panel (no extra Mongo aggregate). Posts to its own channel
// (separate from the weekly digest) only when the ranking actually changes.
const config = require("./config");
const { memberSalary } = require("./builders/lootPanel");
const { getTop5PanelSalary, saveTop5PanelSalary } = require("./state");

const MEDAL = ["🥇", "🥈", "🥉", "4.", "5."];

async function checkTop5Records(client, panel) {
  if (!config.top5ChannelId) return;
  const total = panel.members.reduce((sum, uid) => sum + memberSalary(panel, uid), 0);
  if (!total) return;

  const top5 = await getTop5PanelSalary();
  if (top5.length >= 5 && total <= top5[top5.length - 1].amount) return; // doesn't crack the top 5

  const before = top5.map((e) => e.panelId).join(",");
  top5.push({
    panelId: panel.lootMsgId,
    panelTitle: panel.eventTitle,
    sellerName: panel.sellerIgn || `<@${panel.sellerId}>`,
    threadId: panel.threadId,
    amount: total,
  });
  top5.sort((a, b) => b.amount - a.amount);
  top5.length = Math.min(top5.length, 5);
  await saveTop5PanelSalary(top5);

  if (top5.map((e) => e.panelId).join(",") === before) return; // no change → not a record moment

  const lines = top5.map(
    (e, i) => `${MEDAL[i]} [${e.panelTitle}](https://discord.com/channels/${config.guildId}/${e.threadId}/${e.panelId}) — ${e.sellerName} — **${e.amount.toLocaleString()}g** (${Math.floor(e.amount / 8)}g/person)`,
  );
  const channel = await client.channels.fetch(config.top5ChannelId);
  await channel.send(`🎉 **New Record! Top 5 Raid dengan Total Gaji Terbesar**\n${lines.join("\n")}`);
}

module.exports = { checkTop5Records };
