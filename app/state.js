const { MongoClient } = require("mongodb");
const config = require("./config");

const activeEvents = {};
const cooldowns = new Map();
const activeLootPanels = {};
const pendingEphemerals = new Map(); // `${lootMsgId}:${userId}` → original button interaction
const pendingResolutions = new Map(); // `${lootMsgId}:${userId}` → [{ raw, qty, candidates }]

let collection = null;

// Connect to MongoDB and hydrate in-memory state. Call once before login.
async function loadState() {
  if (!config.mongoUri) {
    console.warn("⚠️ MONGODB_URI not set — state will NOT persist across restarts.");
    return;
  }

  const client = new MongoClient(config.mongoUri);
  await client.connect();
  collection = client.db("bot-raid").collection("balance");

  const doc = await collection.findOne({ _id: "state" });
  if (doc) {
    Object.assign(activeEvents, doc.activeEvents || {});
    Object.assign(activeLootPanels, doc.activeLootPanels || {});
  }
  console.log(
    `📂 Loaded state from MongoDB: ${Object.keys(activeEvents).length} events, ${Object.keys(activeLootPanels).length} loot panels`,
  );
}

// Fire-and-forget: kicks off the write without blocking the caller.
function saveState() {
  if (!collection) return;
  collection
    .replaceOne({ _id: "state" }, { _id: "state", activeEvents, activeLootPanels }, { upsert: true })
    .catch((err) => console.error("❌ saveState failed:", err.message));
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

function setPendingResolution(lootMsgId, userId, list) {
  pendingResolutions.set(`${lootMsgId}:${userId}`, list);
}

function takePendingResolution(lootMsgId, userId) {
  const key = `${lootMsgId}:${userId}`;
  const list = pendingResolutions.get(key);
  pendingResolutions.delete(key);
  return list || null;
}

module.exports = {
  activeEvents,
  cooldowns,
  activeLootPanels,
  loadState,
  saveState,
  setPendingEphemeral,
  clearPendingEphemeral,
  setPendingResolution,
  takePendingResolution,
};
