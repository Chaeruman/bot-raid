// Weekly top-10 salary leaderboard — runs in-process (no new Render service,
// no cron dependency), gated behind DIGEST_ENABLED so it can be killed
// instantly via env var without a redeploy if it ever misbehaves.
const { getSalaryTotalsSince, getDigestLastSent, setDigestLastSent } = require("./state");
const config = require("./config");
const { armAt } = require("./utils/schedule");

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const TARGET_DAY = 5; // Friday
const TARGET_HOUR = 23; // 23:00 WIB — ponytail: hardcoded, move to config if other slots are ever needed
const TOP_N = 10;

const MEDAL = ["🥇", "🥈", "🥉"];

// Returns how many entries were posted (0 = nothing to post, caller can tell
// that apart from an actual send).
async function sendWeeklyDigest(client) {
  if (!config.digestChannelId) {
    console.warn("⚠️ DIGEST_CHANNEL_ID not set — skipping weekly digest.");
    return 0;
  }
  const since = new Date(Date.now() - WEEK_MS);
  const totals = await getSalaryTotalsSince(since);
  const top = totals
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N);

  if (top.length === 0) return 0;

  const lines = top.map((r, i) => `${MEDAL[i] || `#${i + 1}`} <@${r._id}> — **${r.total.toLocaleString()}g**`);
  const channel = await client.channels.fetch(config.digestChannelId);
  await channel.send(`🏆 **Top ${top.length} Gaji Terbanyak Minggu Ini**\n${lines.join("\n")}`);
  return top.length;
}

function startWeeklyDigest(client) {
  if (process.env.DIGEST_ENABLED !== "true") {
    console.log("📭 Weekly digest off (set DIGEST_ENABLED=true di Render env buat nyalain)");
    return;
  }
  armAt(TARGET_HOUR, TARGET_DAY, () => {
    if (Date.now() - getDigestLastSent() < WEEK_MS - DAY_MS) return; // already sent this week
    setDigestLastSent(Date.now());
    sendWeeklyDigest(client).catch((err) => console.error("❌ sendWeeklyDigest failed:", err.message));
  });
  console.log("📬 Weekly digest aktif — tiap Jumat 23:00 WIB");
}

module.exports = { startWeeklyDigest, sendWeeklyDigest, TARGET_DAY, TARGET_HOUR };
