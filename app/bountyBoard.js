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
const { MAX_SHARE_STACK } = require("./data/bounty");

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

// The real account name never reaches the board. A reader only ever asks one
// thing of it — can these two characters go at the same time? — so a letter per
// account answers it without publishing what anyone called theirs.
//
// Letters are assigned per player and stay put across the whole board, so "akun
// A" in one nest is the same account as "akun A" in another.
function accountLetters(charDocs = []) {
  const of = new Map(); // ckey → "A" | "B" | …
  for (const doc of charDocs) {
    const seen = new Map();
    for (const c of doc.chars || []) {
      if (!c.account) continue;
      if (!seen.has(c.account)) seen.set(c.account, String.fromCharCode(65 + seen.size));
      of.set(ckey(doc._id, c.name), seen.get(c.account));
    }
  }
  return of;
}

// One line per character, mention included. A header line per player doubled
// the height of the board for nothing — almost everyone has exactly one
// character in a given nest.
//
// The letter only shows when this player has TWO characters here, which is the
// only case it disambiguates: the same letter means two separate runs.
//
// A character with two quests for one nest is still ONE line — clearing once
// completes both, so two lines would read as two characters.
const renderPlayer = (e, letters) =>
  e.chars
    .map((c) => {
      const letter = letters?.get(ckey(e.userId, c.charName));
      return (
        `<@${e.userId}> **${c.charName}**` +
        `${c.quests.length > 1 ? ` (${c.quests.length} quest)` : ""}` +
        `${e.chars.length > 1 && letter ? ` · akun ${letter}` : ""}` +
        ` — ${c.quests.map(rewardText).join(" | ")}`
      );
    })
    .join("\n");

// Marathon GDN is the run this guild actually forms, so the board answers "is
// there anything in it this week" in one line, without anyone opening a panel.
//
// A summary, not a listing. It does not seat anybody — the bot has no idea who
// is online, and a printed seating chart reads as a plan.
function marathonBlock(weekDocs, charDocs = []) {
  const pools = require("./templates").marathon_gdn.poolKeys;
  const roleOf = new Map();
  for (const doc of charDocs)
    for (const c of doc.chars || []) roleOf.set(ckey(doc._id, c.name), c.role || null);

  const perPool = new Map(pools.map((p) => [p, 0]));
  const rows = [];

  for (const doc of weekDocs) {
    const userId = doc.owners?.[0] || String(doc._id).split(":")[0];
    for (const [charName, charWeek] of Object.entries(doc.chars || {})) {
      const mine = (charWeek.board || []).filter((q) => !q.runId && perPool.has(q.poolKey));
      if (!mine.length) continue;
      for (const q of mine) perPool.set(q.poolKey, perPool.get(q.poolKey) + 1);
      rows.push({
        name: charName,
        role: roleOf.get(ckey(userId, charName)) || "?",
        // Which of the two clears each quest is for. A marathon is two runs, and
        // this is what says which one you are being asked to show up for.
        bounty: mine
          .map((q) => `${BY_POOL_KEY.get(q.poolKey)?.label || q.poolKey} · ${rewardText(q)}`)
          .join(" | "),
      });
    }
  }

  const total = [...perPool.values()].reduce((a, b) => a + b, 0);
  if (!total) return null;

  // The split is the line that decides anything: HC 0 means no marathon this
  // week, whatever the total says.
  const split = pools.map((p) => `${BY_POOL_KEY.get(p)?.label || p} ${perPool.get(p)}`).join(" · ");
  // Names in a padded code span so the roles line up in one column — the same
  // trick the signup panel uses for its role list.
  const width = Math.max(...rows.map((r) => r.name.length));

  return [
    `**🏃 Marathon GDN** — ${total} bounty quest · ${split}`,
    ...rows
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => `\`${r.name.padEnd(width)}\` - ${r.role} (bounty ${r.bounty})`),
  ].join("\n");
}

const section = (g, letters) =>
  [`**${g.variant.short}** — ${g.total}`, ...g.entries.map((e) => renderPlayer(e, letters))].join("\n");

// A blank line between nests. Without it the sections run together and a bold
// nest name is the only thing separating two lists of names.
const joinSections = (groups, letters) => {
  const [first, ...rest] = groups;
  const lines = [section(first, letters)];
  if (rest.length) lines.push("", ...rest.flatMap((g) => [section(g, letters), ""]));
  return lines.join("\n");
};

// Two embeds in one message rather than two messages: one id to remember, one
// delete at reset, and they stay next to each other so nobody scrolls past the
// second one without seeing it.
function buildBoardEmbeds(weekDocs, charDocs = [], now = new Date()) {
  const groups = groupByVariant(weekDocs, charDocs);
  const letters = accountLetters(charDocs);
  const foot = { text: weekLabelId(now) };

  if (!groups.length)
    return [
      new EmbedBuilder()
        .setTitle("📋 BOUNTY BOARD")
        .setColor(0xe67e22)
        .setDescription("Belum ada yang mencatat bounty minggu ini.\nCatat punyamu lewat `/bounty-me`.")
        .setFooter(foot),
    ];

  // The marathon block sits ABOVE the GDN sections, it does not replace them.
  // Merging them cost the thing the board exists for — "GDN HC — 3" answers
  // "who else has HC" in one glance, and a merged list makes you filter by eye.
  // The duplication that merging was meant to fix is gone anyway: the summary
  // names nobody twice because it carries no mentions, roles or rewards.
  const marathon = marathonBlock(weekDocs, charDocs);
  const raid = groups.filter((g) => g.variant.capacity === 8);
  const nest = groups.filter((g) => g.variant.capacity !== 8);
  const embeds = [];

  if (raid.length || marathon)
    embeds.push(
      new EmbedBuilder()
        .setTitle("📋 BOUNTY BOARD — Raid (8 orang)")
        .setColor(0xe67e22)
        .setDescription(
          [marathon, raid.length ? joinSections(raid, letters) : null]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 4000),
        ),
    );

  if (nest.length)
    embeds.push(
      new EmbedBuilder()
        .setTitle("📋 Nest (4 orang)")
        .setColor(0xe67e22)
        .setDescription(joinSections(nest, letters).slice(0, 4000)),
    );

  // The week belongs on the last one, where it reads as a footer for the whole
  // message rather than a repeated stamp.
  embeds[embeds.length - 1].setFooter(foot);
  return embeds;
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
  const embeds = buildBoardEmbeds(weekDocs, charDocs);

  // Week rolled over — drop last week's board and start a fresh one.
  if (bountyBoard.weekKey && bountyBoard.weekKey !== wk) {
    // A new week empties every panel of last week's quests. Redrawing them here
    // is also the second of the two weekly touches that keep the threads awake.
    require("./bountyThread").refreshAll(client).catch(() => {});
    await channel.messages
      .fetch(bountyBoard.messageId)
      .then((m) => m.delete())
      .catch(() => {});
    bountyBoard.messageId = null;
  }

  if (bountyBoard.messageId) {
    const msg = await channel.messages.fetch(bountyBoard.messageId).catch(() => null);
    if (msg) return msg.edit({ embeds });
    bountyBoard.messageId = null; // deleted by hand — repost below
  }

  const msg = await channel.send({ embeds });
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

module.exports = { buildBoardEmbeds, groupByVariant, accountLetters, marathonBlock, weekLabelId, syncBoard, startBoard };
