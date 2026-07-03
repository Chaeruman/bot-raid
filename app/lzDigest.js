// Daily Lucky Zone post — same shape as digest.js's weekly digest, but every
// day instead of just Saturday. Low-stakes info (not money), so a missed post
// from a restart landing on the window is fine — no retry/recheck mechanism,
// the /lz command is always there as a manual fallback.
const config = require("./config");
const { formatLzMessage } = require("./data/luckyZone");
const { getLzDigestLastSent, setLzDigestLastSent } = require("./state");

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TARGET_HOUR = 8; // 08:00 WIB

function isLzWindow(now = Date.now()) {
  const wib = new Date(now + 7 * HOUR_MS);
  return wib.getUTCHours() === TARGET_HOUR;
}

async function sendLzDigest(client) {
  if (!config.lzChannelId) return;
  const channel = await client.channels.fetch(config.lzChannelId);
  await channel.send(formatLzMessage());
}

function startLzDigest(client) {
  if (process.env.LZ_DIGEST_ENABLED !== "true") {
    console.log("📭 LZ digest off (set LZ_DIGEST_ENABLED=true di Render env buat nyalain)");
    return;
  }
  setInterval(() => {
    if (!isLzWindow()) return;
    if (Date.now() - getLzDigestLastSent() < DAY_MS - HOUR_MS) return; // already sent today
    setLzDigestLastSent(Date.now());
    sendLzDigest(client).catch((err) => console.error("❌ sendLzDigest failed:", err.message));
  }, HOUR_MS);
  console.log("📬 LZ digest aktif — tiap hari 08:00 WIB");
}

module.exports = { startLzDigest, sendLzDigest, isLzWindow };
