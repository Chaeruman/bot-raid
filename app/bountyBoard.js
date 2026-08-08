// The weekly bounty board — one message in #bounty-board, posted at reset and
// edited for the rest of the week. Answers "siapa lagi yang punya GDN CL?"
// without anyone running a command.
//
// Read-only by design: no buttons, no menus. Party forming lives on the signup
// panels, which already own everything a party needs.
const { EmbedBuilder } = require("discord.js");
const config = require("./config");
const { bountyBoard, saveState, getBountyWeekAll, getAllChars } = require("./state");
const { BY_POOL_KEY, weekKey, ckey, resetSaturday, weekOrdinal, rewardText } = require("./bounty");

const HOUR_MS = 60 * 60 * 1000;

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// "minggu ke-1 Agustus 2026" — the board is read by players, so it gets the
// Indonesian label rather than the storage key.
function weekLabelId(now = new Date()) {
  const sat = resetSaturday(now);
  return `minggu ke-${weekOrdinal(sat)} ${MONTHS_ID[sat.getUTCMonth()]} ${sat.getUTCFullYear()}`;
}

// Unclaimed quests grouped by variant, then by PLAYER, then by character — one
// person with three characters is one block, not three loose lines repeating
// the same mention.
//
// The game account rides along because the bot cannot act on it but a reader
// can: two characters on one account are two separate runs, on two accounts
// they can go at the same time with someone else at the keyboard.
function groupByVariant(weekDocs, charDocs = []) {
  const accountOf = new Map();
  for (const doc of charDocs)
    for (const c of doc.chars || []) accountOf.set(ckey(doc._id, c.name), c.account || null);

  const byVariant = new Map();

  for (const doc of weekDocs) {
    const userId = doc.owners?.[0] || String(doc._id).split(":")[0];
    for (const [charName, charWeek] of Object.entries(doc.chars || {})) {
      for (const q of charWeek.board || []) {
        if (q.runId) continue;
        if (!BY_POOL_KEY.has(q.poolKey)) continue;

        if (!byVariant.has(q.poolKey)) byVariant.set(q.poolKey, new Map());
        const players = byVariant.get(q.poolKey);
        if (!players.has(userId)) players.set(userId, new Map());
        const chars = players.get(userId);
        if (!chars.has(charName)) chars.set(charName, []);
        chars.get(charName).push(q);
        chars.get(charName).account = accountOf.get(ckey(userId, charName)) || null;
      }
    }
  }

  return [...byVariant.entries()]
    .map(([poolKey, players]) => {
      const entries = [...players]
        .map(([userId, chars]) => ({
          userId,
          chars: [...chars]
            .map(([charName, quests]) => ({ charName, quests, account: quests.account || null }))
            // Same account together, so "these two need two runs" reads at a glance.
            .sort(
              (a, b) =>
                String(a.account).localeCompare(String(b.account)) ||
                b.quests.length - a.quests.length ||
                a.charName.localeCompare(b.charName),
            ),
        }))
        .sort((a, b) => b.chars.length - a.chars.length);
      const total = entries.reduce((n, e) => n + e.chars.reduce((m, c) => m + c.quests.length, 0), 0);
      return { variant: BY_POOL_KEY.get(poolKey), entries, total };
    })
    .sort((a, b) => b.total - a.total || a.variant.name.localeCompare(b.variant.name));
}

// One line per character, mention included. A header line per player doubled
// the height of the board for nothing — almost everyone has exactly one
// character in a given nest.
//
// The account only shows when this player has TWO characters here, which is the
// only case it disambiguates: same account means two separate runs.
//
// A character with two quests for one nest is still ONE line — clearing once
// completes both, so two lines would read as two characters.
const renderPlayer = (e) =>
  e.chars
    .map(
      (c) =>
        `<@${e.userId}> **${c.charName}**` +
        `${c.quests.length > 1 ? ` (${c.quests.length} quest)` : ""}` +
        `${e.chars.length > 1 && c.account ? ` · akun ${c.account}` : ""}` +
        ` — ${c.quests.map(rewardText).join(" | ")}`,
    )
    .join("\n");

function buildBoardEmbed(weekDocs, charDocs = [], now = new Date()) {
  const groups = groupByVariant(weekDocs, charDocs);
  const embed = new EmbedBuilder()
    .setTitle("📋 BOUNTY BOARD")
    .setColor(0xe67e22)
    .setFooter({ text: weekLabelId(now) });

  if (!groups.length) {
    embed.setDescription("Belum ada yang mencatat bounty minggu ini.\nCatat punyamu dengan `/bounty`.");
    return embed;
  }

  const section = (g) =>
    [`**${g.variant.name}** — ${g.total}`, ...g.entries.map(renderPlayer)].join("\n");

  // A blank line between nests. Without it the sections run together and a bold
  // nest name is the only thing separating two lists of names.
  const [first, ...rest] = groups;
  const lines = [section(first)];
  if (rest.length) lines.push("", ...rest.flatMap((g) => [section(g), ""]));

  embed.setDescription(lines.join("\n").slice(0, 4000));
  return embed;
}

// Posts the board when the week has rolled over, edits it otherwise. Keyed by
// weekKey rather than a timestamp: a new week is a new key, so a restart across
// reset can neither miss nor duplicate — the same trick the rest of the feature
// uses instead of a scheduled job.
async function syncBoard(client) {
  if (!config.bountyBoardChannelId) return;

  const wk = weekKey();
  const channel = await client.channels.fetch(config.bountyBoardChannelId).catch(() => null);
  if (!channel) return;

  const [weekDocs, charDocs] = await Promise.all([getBountyWeekAll(wk), getAllChars()]);
  const embed = buildBoardEmbed(weekDocs, charDocs);

  // Week rolled over — drop last week's board and start a fresh one.
  if (bountyBoard.weekKey && bountyBoard.weekKey !== wk) {
    await channel.messages
      .fetch(bountyBoard.messageId)
      .then((m) => m.delete())
      .catch(() => {});
    bountyBoard.messageId = null;
  }

  if (bountyBoard.messageId) {
    const msg = await channel.messages.fetch(bountyBoard.messageId).catch(() => null);
    if (msg) return msg.edit({ embeds: [embed] });
    bountyBoard.messageId = null; // deleted by hand — repost below
  }

  const msg = await channel.send({ embeds: [embed] });
  bountyBoard.messageId = msg.id;
  bountyBoard.weekKey = wk;
  saveState();
}

function startBoard(client) {
  if (!config.bountyBoardChannelId) {
    console.log("📋 Bounty board off (BOUNTY_BOARD_CHANNEL_ID belum diset)");
    return;
  }
  const tick = () => syncBoard(client).catch((err) => console.error("❌ syncBoard:", err.message));
  tick(); // catch up immediately on boot, in case reset passed while we were down
  setInterval(tick, HOUR_MS);
  console.log("📋 Bounty board aktif — dicek tiap jam, ganti pesan tiap reset Sabtu 08:00 WIB");
}

module.exports = { buildBoardEmbed, groupByVariant, weekLabelId, syncBoard, startBoard };
