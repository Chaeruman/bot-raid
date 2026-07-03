// Weekly top-10 salary leaderboard — runs in-process (no new Render service,
// no cron dependency), gated behind DIGEST_ENABLED so it can be killed
// instantly via env var without a redeploy if it ever misbehaves.
const { getSalaryTotalsSince, getDigestLastSent, setDigestLastSent } = require("./state");
const config = require("./config");

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const TARGET_DAY = 1; // Monday
const TARGET_HOUR = 9; // 09:00 WIB — ponytail: hardcoded, move to config if other slots are ever needed
const TOP_N = 10;

function isDigestWindow(now = Date.now()) {
  const wib = new Date(now + 7 * HOUR_MS); // UTC+7, no timezone lib needed for a fixed offset
  return wib.getUTCDay() === TARGET_DAY && wib.getUTCHours() === TARGET_HOUR;
}

const MEDAL = ["🥇", "🥈", "🥉"];

async function sendWeeklyDigest(client) {
  if (!config.digestChannelId) {
    console.warn("⚠️ DIGEST_CHANNEL_ID not set — skipping weekly digest.");
    return;
  }
  const since = new Date(Date.now() - WEEK_MS);
  const totals = await getSalaryTotalsSince(since);
  const top = totals
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N);

  if (top.length === 0) return;

  const lines = top.map((r, i) => `${MEDAL[i] || `#${i + 1}`} <@${r._id}> — **${r.total.toLocaleString()}g**`);
  const channel = await client.channels.fetch(config.digestChannelId);
  await channel.send(`🏆 **Top ${top.length} Gaji Terbanyak Minggu Ini**\n${lines.join("\n")}`);
}

function startWeeklyDigest(client) {
  if (process.env.DIGEST_ENABLED !== "true") {
    console.log("📭 Weekly digest off (set DIGEST_ENABLED=true di Render env buat nyalain)");
    return;
  }
  setInterval(() => {
    if (!isDigestWindow()) return;
    if (Date.now() - getDigestLastSent() < WEEK_MS - DAY_MS) return; // already sent this week
    setDigestLastSent(Date.now());
    sendWeeklyDigest(client).catch((err) => console.error("❌ sendWeeklyDigest failed:", err.message));
  }, HOUR_MS);
  console.log("📬 Weekly digest aktif — tiap Senin 09:00 WIB");
}

module.exports = { startWeeklyDigest, sendWeeklyDigest, isDigestWindow };
