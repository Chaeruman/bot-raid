// The weekly bounty board — one message in #bounty-board, posted at reset and
// edited for the rest of the week. Answers "siapa lagi yang punya GDN CL?"
// without anyone running a command.
//
// Read-only by design: no buttons, no menus. Party forming lives on the signup
// panels, which already own everything a party needs.
const { EmbedBuilder } = require("discord.js");
const config = require("./config");
const { bountyBoard, saveState, getBountyWeekAll, getAllChars, primaryOf } = require("./state");
const { BY_POOL_KEY, weekKey, ckey, resetSaturday, weekOrdinal, rewardText } = require("./bounty");
const { MAX_SHARE_STACK } = require("./data/bounty");
const { armAt } = require("./utils/schedule");

const HOUR_MS = 60 * 60 * 1000;
const RESET_DAY = 6;   // Saturday, as getUTCDay counts
const RESET_HOUR = 8;  // 08:00 WIB

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
    for (const c of doc.chars || [])
      accountOf.set(ckey(primaryOf(doc._id), c.name), c.account || null);

  const byVariant = new Map();

  for (const doc of weekDocs) {
    // Linked accounts collapse to one mention — they are one person, and two
    // entries side by side would read as two people to bring.
    const userId = primaryOf(doc.owners?.[0] || String(doc._id).split(":")[0]);
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
  // Lettered per PERSON, not per document. Two linked accounts each starting
  // again at A would print two different accounts as "akun A" side by side —
  // the exact confusion the letter exists to remove.
  const seenBy = new Map(); // primary → Map(account → letter)
  for (const doc of charDocs) {
    const p = primaryOf(doc._id);
    if (!seenBy.has(p)) seenBy.set(p, new Map());
    const seen = seenBy.get(p);
    for (const c of doc.chars || []) {
      if (!c.account) continue;
      if (!seen.has(c.account)) seen.set(c.account, String.fromCharCode(65 + seen.size));
      of.set(ckey(p, c.name), seen.get(c.account));
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
    for (const c of doc.chars || [])
      roleOf.set(ckey(primaryOf(doc._id), c.name), c.role || null);

  const perPool = new Map(pools.map((p) => [p, 0]));
  const rows = [];

  for (const doc of weekDocs) {
    const userId = primaryOf(doc.owners?.[0] || String(doc._id).split(":")[0]);
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

// Discord's limits, and what each one costs here: 4096 per embed description,
// 6000 across every embed in one message, 10 embeds.
const PER_EMBED = 3500; // split BEFORE a section can push an embed past 4096
const PER_MESSAGE = 6000;
const MAX_EMBEDS = 10;

// One embed until it is nearly full, then another — never a fixed number of
// nests each. Splitting early scatters a board that fits comfortably; splitting
// late loses the tail.
//
// A blank line between nests. Without it the sections run together and a bold
// nest name is the only thing separating two lists of names.
function chunkSections(groups, letters, head = null) {
  const chunks = [];
  let cur = head ? [head] : [];
  let len = head ? head.length + 2 : 0;

  for (const g of groups) {
    const s = section(g, letters);
    if (cur.length && len + s.length + 2 > PER_EMBED) {
      chunks.push(cur.join("\n\n"));
      cur = [];
      len = 0;
    }
    cur.push(s);
    len += s.length + 2;
  }
  if (cur.length) chunks.push(cur.join("\n\n"));
  return chunks;
}

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

  // A page number ONLY when there is more than one page. On a board that fits —
  // which is every board today — "1/1" is noise about a limit nobody hit.
  const add = (embeds, title, chunks) =>
    chunks.forEach((d, i) =>
      embeds.push(
        new EmbedBuilder()
          .setTitle(chunks.length > 1 ? `${title} · ${i + 1}/${chunks.length}` : title)
          .setColor(0xe67e22)
          .setDescription(d.slice(0, 4000)),
      ),
    );

  const embeds = [];
  if (raid.length || marathon)
    add(embeds, "📋 BOUNTY BOARD — Raid (8 orang)", chunkSections(raid, letters, marathon));
  if (nest.length) add(embeds, "📋 Nest (4 orang)", chunkSections(nest, letters));

  // Past 6000 characters or 10 embeds Discord rejects the whole message, and the
  // board would simply vanish. Dropping the tail and saying so keeps the rest
  // readable and makes the loss visible instead of total.
  let total = 0;
  const kept = [];
  for (const e of embeds) {
    const size = (e.data.description || "").length + (e.data.title || "").length;
    if (kept.length >= MAX_EMBEDS || total + size > PER_MESSAGE) break;
    total += size;
    kept.push(e);
  }
  if (kept.length < embeds.length) {
    const lost = embeds.length - kept.length;
    console.error(`❌ bounty board terpotong: ${lost} bagian tidak muat (${total}/${PER_MESSAGE})`);
    kept[kept.length - 1].setDescription(
      `${kept[kept.length - 1].data.description}\n\n_⚠️ ${lost} bagian tidak muat di satu pesan._`.slice(0, 4000),
    );
  }

  // The week belongs on the last one, where it reads as a footer for the whole
  // message rather than a repeated stamp.
  kept[kept.length - 1].setFooter(foot);
  return kept;
}

// Posts the board when the week has rolled over, edits it otherwise. Keyed by
// weekKey rather than a timestamp: a new week is a new key, so a restart across
// reset can neither miss nor duplicate — the same trick the rest of the feature
// uses instead of a scheduled job.
let warnedNoChannel = false;

async function syncBoard(client) {
  if (!config.bountyBoardChannelId) return;

  const wk = weekKey();
  const channel = await client.channels.fetch(config.bountyBoardChannelId).catch(() => null);
  // Same silent hole the market board had: a wrong id meant the board never
  // appeared and nothing said why. Once per process — the id comes from the
  // environment and cannot change while we run.
  if (!channel) {
    if (!warnedNoChannel) {
      warnedNoChannel = true;
      console.error(
        `❌ bounty board: channel ${config.bountyBoardChannelId} tidak ketemu — cek BOUNTY_BOARD_CHANNEL_ID, atau bot belum punya akses ke channel itu`,
      );
    }
    return;
  }
  warnedNoChannel = false;

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

  // On the reset itself, so the new board is up at 08:00 and not at whatever
  // minute Render last restarted the bot — an interval starts ticking when the
  // PROCESS does, which had the changeover landing up to an hour late.
  armAt(RESET_HOUR, RESET_DAY, tick);

  // The hourly pass stays, doing the other job: reposting a board somebody
  // deleted by hand. syncBoard is idempotent, so the two never fight.
  setInterval(tick, HOUR_MS);
  console.log("📋 Bounty board aktif — dicek tiap jam, ganti pesan tepat di reset Sabtu 08:00 WIB");
}

module.exports = {
  buildBoardEmbeds, groupByVariant, accountLetters, marathonBlock, weekLabelId,
  syncBoard, startBoard, RESET_DAY, RESET_HOUR,
};
