// Daily Lucky Zone post — same shape as digest.js's weekly digest, but every
// day instead of just Saturday. Low-stakes info (not money), so a missed post
// from a restart landing on the window is fine — no retry/recheck mechanism,
// the /lz command is always there as a manual fallback.
const config = require("./config");
const { formatLzMessage } = require("./data/luckyZone");
const { getLzDigestLastSent, setLzDigestLastSent } = require("./state");
const { armAt } = require("./utils/schedule");

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TARGET_HOUR = 0; // 00:00 WIB

async function sendLzDigest(client) {
  if (!config.lzChannelId) return;
  const channel = await client.channels.fetch(config.lzChannelId);
  await channel.send(formatLzMessage());
  console.log("📨 LZ digest terkirim");
}

function startLzDigest(client) {
  if (process.env.LZ_DIGEST_ENABLED !== "true") {
    console.log("📭 LZ digest off (set LZ_DIGEST_ENABLED=true di Render env buat nyalain)");
    return;
  }
  armAt(TARGET_HOUR, null, () => {
    // A restart at 23:59 can arm a timer that fires seconds after one already
    // went out. Cheap insurance; nothing else stops a double post.
    if (Date.now() - getLzDigestLastSent() < DAY_MS - HOUR_MS) return;
    setLzDigestLastSent(Date.now());
    sendLzDigest(client).catch((err) => console.error("❌ sendLzDigest failed:", err.message));
  });
  console.log(`📬 LZ digest aktif — tiap hari ${String(TARGET_HOUR).padStart(2, "0")}:00 WIB`);
}

module.exports = { startLzDigest, sendLzDigest, TARGET_HOUR };
