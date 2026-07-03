const { MongoClient } = require("mongodb");
const config = require("./config");

const activeEvents = {};
const cooldowns = new Map();
const activeLootPanels = {};
const pendingEphemerals = new Map(); // `${lootMsgId}:${userId}` → original button interaction
const pendingResolutions = new Map(); // `${lootMsgId}:${userId}` → [{ raw, qty, candidates }]

let collection = null;
let salaryLogCollection = null;
let digestLastSent = 0; // ms epoch, persisted so a Render restart doesn't cause a duplicate/missed weekly digest
let lzDigestLastSent = 0; // same idea, daily instead of weekly

// Connect to MongoDB and hydrate in-memory state. Call once before login.
async function loadState() {
  if (!config.mongoUri) {
    console.warn("⚠️ MONGODB_URI not set — state will NOT persist across restarts.");
    return;
  }

  const client = new MongoClient(config.mongoUri);
  await client.connect();
  const db = client.db(config.mongoDbName);
  collection = db.collection("balance");
  salaryLogCollection = db.collection("salaryLog");

  const doc = await collection.findOne({ _id: "state" });
  if (doc) {
    Object.assign(activeEvents, doc.activeEvents || {});
    Object.assign(activeLootPanels, doc.activeLootPanels || {});
    digestLastSent = doc.digestLastSent || 0;
    lzDigestLastSent = doc.lzDigestLastSent || 0;
  }
  console.log(
    `📂 Loaded state from MongoDB: ${Object.keys(activeEvents).length} events, ${Object.keys(activeLootPanels).length} loot panels`,
  );
}

// Fire-and-forget: kicks off the write without blocking the caller.
function saveState() {
  if (!collection) return;
  collection
    .replaceOne({ _id: "state" }, { _id: "state", activeEvents, activeLootPanels, digestLastSent, lzDigestLastSent }, { upsert: true })
    .catch((err) => console.error("❌ saveState failed:", err.message));
}

function getDigestLastSent() {
  return digestLastSent;
}

function setDigestLastSent(ts) {
  digestLastSent = ts;
  saveState();
}

function getLzDigestLastSent() {
  return lzDigestLastSent;
}

function setLzDigestLastSent(ts) {
  lzDigestLastSent = ts;
  saveState();
}

// One doc per (panel, member) payout. Upsert on mark-paid, delete on un-mark —
// storage stays bounded to "who got paid on which panel", never grows unbounded.
// details: { sellerId, panelTitle, threadId } — carried along so /gaji-saya can
// show a breakdown without re-fetching panels (panels get deleted once closed).
function recordSalaryPaid(panelId, uid, amount, details) {
  if (!salaryLogCollection) return;
  salaryLogCollection
    .replaceOne(
      { _id: `${panelId}:${uid}` },
      { _id: `${panelId}:${uid}`, uid, amount, paidAt: new Date(), panelId, ...details },
      { upsert: true },
    )
    .catch((err) => console.error("❌ recordSalaryPaid failed:", err.message));
}

function removeSalaryPaid(panelId, uid) {
  if (!salaryLogCollection) return;
  salaryLogCollection.deleteOne({ _id: `${panelId}:${uid}` }).catch((err) => console.error("❌ removeSalaryPaid failed:", err.message));
}

// Payout rows for a member since `since` (inclusive), newest first.
async function getSalaryLog(uid, since) {
  if (!salaryLogCollection) return [];
  return salaryLogCollection.find({ uid, paidAt: { $gte: since } }).sort({ paidAt: -1 }).toArray();
}

// Every member's total payout since `since`, grouped by uid — feeds the weekly digest.
async function getSalaryTotalsSince(since) {
  if (!salaryLogCollection) return [];
  return salaryLogCollection
    .aggregate([{ $match: { paidAt: { $gte: since } } }, { $group: { _id: "$uid", total: { $sum: "$amount" } } }])
    .toArray();
}

// Top-5 highest total salary ever paid out from a single panel — single
// doc, at most 5 entries, so it never grows. Separate from everything else
// (weekly digest, /gaji-saya) — doesn't touch or replace their data.
async function getTop5PanelSalary() {
  if (!collection) return [];
  const doc = await collection.findOne({ _id: "top5PanelSalary" });
  return doc?.top5 || [];
}

async function saveTop5PanelSalary(top5) {
  if (!collection) return;
  await collection.replaceOne({ _id: "top5PanelSalary" }, { _id: "top5PanelSalary", top5 }, { upsert: true });
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
  recordSalaryPaid,
  removeSalaryPaid,
  getSalaryLog,
  getSalaryTotalsSince,
  getTop5PanelSalary,
  saveTop5PanelSalary,
  getDigestLastSent,
  setDigestLastSent,
  getLzDigestLastSent,
  setLzDigestLastSent,
  setPendingEphemeral,
  clearPendingEphemeral,
  setPendingResolution,
  takePendingResolution,
};
