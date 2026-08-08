// Thursday nudge before the Saturday reset, and the thing that keeps every
// private thread awake.
//
// It names people, not quests. The board already lists what everyone is
// holding, so repeating it here would be a second copy to keep correct — the
// reminder's job is the deadline and the mention.
//
// It says "not recorded as cleared", never "not cleared". The bot only learns a quest
// is done when a run closes through the signup panel; a party formed in chat is
// invisible to it. Asserting more than that would make the reminder wrong for
// exactly the people who are most on top of things.
const config = require("./config");
const { getBountyWeekAll, getBountyReminderLastSent, setBountyReminderLastSent, primaryOf } = require("./state");
const { weekKey } = require("./bounty");
const { MIN_WORTH_RANK, rankOf } = require("./data/bounty");

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const TARGET_DAY = 4; // Thursday
const TARGET_HOUR = 20; // 20:00 WIB — two nights before reset, enough to still form a party

const isReminderWindow = (now = Date.now()) => {
  const wib = new Date(now + 7 * HOUR_MS); // UTC+7, a fixed offset needs no timezone library
  return wib.getUTCDay() === TARGET_DAY && wib.getUTCHours() === TARGET_HOUR;
};

// Only quests worth a run. Every rarity the parser accepts is already above the
// threshold, so today this excludes nothing — it is here so that adding a lesser
// rarity later cannot quietly pad the reminder with things nobody intends to do.
function holders(weekDocs) {
  // Linked accounts are one person, so their counts add up under one mention
  // rather than pinging the same human twice.
  const byUser = new Map();
  for (const doc of weekDocs) {
    const userId = primaryOf(doc.owners?.[0] || String(doc._id).split(":")[0]);
    let n = 0;
    for (const charWeek of Object.values(doc.chars || {}))
      for (const q of charWeek.board || []) if (!q.runId && rankOf(q) >= MIN_WORTH_RANK) n++;
    if (n) byUser.set(userId, (byUser.get(userId) || 0) + n);
  }
  return [...byUser].map(([userId, n]) => ({ userId, n })).sort((a, b) => b.n - a.n);
}

function buildReminder(weekDocs, now = new Date()) {
  const list = holders(weekDocs);
  if (!list.length) return null;

  const total = list.reduce((a, h) => a + h.n, 0);
  const days = Math.max(0, Math.ceil((nextReset(now) - now) / DAY_MS));

  return (
    `🎯 **Reset Saturday 08:00** — ${days > 0 ? `${days} days left` : "today"}\n\n` +
    `Not recorded as cleared: **${total} quest**\n` +
    list.map((h) => `<@${h.userId}> (${h.n})`).join(" · ") +
    (config.bountyBoardChannelId ? `\n\ncheck on: <#${config.bountyBoardChannelId}>` : "") +
    `\n\n_Cleared? Leave it alone._`
  );
}

// The next Saturday 08:00 WIB at or after `now`.
function nextReset(now = new Date()) {
  const wib = new Date(now.getTime() + 7 * HOUR_MS);
  const reset = new Date(wib);
  reset.setUTCHours(8, 0, 0, 0);
  reset.setUTCDate(reset.getUTCDate() + ((6 - reset.getUTCDay() + 7) % 7));
  if (reset <= wib) reset.setUTCDate(reset.getUTCDate() + 7);
  return new Date(reset.getTime() - 7 * HOUR_MS);
}

async function sendReminder(client) {
  const channelId = config.bountyBoardChannelId;
  if (!channelId) return 0;

  const weekDocs = await getBountyWeekAll(weekKey());
  const list = holders(weekDocs);
  const content = buildReminder(weekDocs);
  if (!content) return 0;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return 0;

  // This one pings. The board deliberately does not, but a reminder nobody is
  // notified about is just another message in a channel they already ignore.
  await channel.send({ content: content.slice(0, 2000) });
  return list.length;
}

function startBountyReminder(client) {
  // Its own switch, not DIGEST_ENABLED — killing the salary leaderboard should
  // not silently take this with it.
  if (process.env.BOUNTY_REMINDER_ENABLED !== "true") {
    console.log("🎯 Bounty reminder off (set BOUNTY_REMINDER_ENABLED=true buat nyalain)");
    return;
  }
  setInterval(() => {
    if (!isReminderWindow()) return;
    if (Date.now() - getBountyReminderLastSent() < WEEK_MS - DAY_MS) return; // already sent this week
    setBountyReminderLastSent(Date.now());
    Promise.all([
      sendReminder(client),
      // Rides along: an edit to every panel is also what stops the threads
      // archiving. Twice a week — here and at reset — keeps the longest gap
      // near four days, well inside Discord's seven.
      require("./bountyThread").refreshAll(client),
    ]).catch((err) => console.error("❌ bounty reminder:", err.message));
  }, HOUR_MS);
  console.log("🎯 Bounty reminder aktif — tiap Kamis 20:00 WIB");
}

module.exports = { startBountyReminder, sendReminder, buildReminder, isReminderWindow, nextReset, holders };
