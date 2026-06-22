const fs = require("fs");
const path = require("path");

const activeEvents = {};
const cooldowns = new Map();
const activeLootPanels = {};
const pendingEphemerals = new Map(); // `${lootMsgId}:${userId}` → original button interaction

const STATE_FILE = path.join(__dirname, "../state.json");

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ activeEvents, activeLootPanels }, null, 2));
  console.log(`💾 state.json saved → ${STATE_FILE} (events: ${Object.keys(activeEvents).length})`);
}

function setPendingEphemeral(lootMsgId, userId, interaction) {
  pendingEphemerals.set(`${lootMsgId}:${userId}`, interaction);
}

function clearPendingEphemeral(lootMsgId, userId) {
  const key = `${lootMsgId}:${userId}`;
  const orig = pendingEphemerals.get(key);
  if (orig) {
    pendingEphemerals.delete(key);
    orig.deleteReply().catch(() => {});
  }
}

module.exports = { activeEvents, cooldowns, activeLootPanels, saveState, setPendingEphemeral, clearPendingEphemeral };
