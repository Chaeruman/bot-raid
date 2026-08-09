const { MongoClient } = require("mongodb");
const config = require("./config");

const activeEvents = {};
const cooldowns = new Map();
const activeLootPanels = {};
const pendingEphemerals = new Map(); // `${lootMsgId}:${userId}` → original button interaction
const pendingResolutions = new Map(); // `${lootMsgId}:${userId}` → [{ raw, qty, candidates }]

let collection = null;
let salaryLogCollection = null;
let charsCollection = null;
let bountyWeekCollection = null;
let digestLastSent = 0; // ms epoch, persisted so a Render restart doesn't cause a duplicate/missed weekly digest
let lzDigestLastSent = 0; // same idea, daily instead of weekly
let bountyReminderLastSent = 0; // same idea, for the Friday pre-reset ping

// Group Bounty thread ids. Tiny and bounded by member count, so they ride along
// in the single state doc rather than earning a collection of their own.
const bountyThreads = {}; // userId → { threadId, messageId } of their panel

// One person, several Discord accounts. A flat map every member to the group's
// PRIMARY — the account that sent the approved invite — including the primary
// to itself, so "who is in this group" is one scan and "who represents it on
// the board" needs no second field.
const bountyLinks = {}; // userId → primary userId
const bountyLinkRequests = {}; // fromUserId → toUserId, waiting on the target's panel
// Pressed the door and had no key. Remembered so a second press does not send
// the admins a second copy of the same request.
const bountyApplications = {}; // userId → true, until the role arrives
// The one pinned "make my thread" message: { messageId }
const bountyEntry = {};
// The one pinned role picker: { messageId }
const rolePickMenu = {};
// Pinned salary buttons: { kirim: messageId, saya: messageId }
const salaryMenus = {};
// The one weekly board message: { messageId, channelId, weekKey }
const bountyBoard = {};

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
  // `chars` is SHARED with the activity planner — see docs/bounty-arch.md §2.4.
  // Bounty reads and writes only name/job/dpsTier and preserves every other
  // field, so whichever feature creates a character first, the other fills in
  // its own part of the same document.
  charsCollection = db.collection("chars");
  bountyWeekCollection = db.collection("bountyWeek");

  const doc = await collection.findOne({ _id: "state" });
  if (doc) {
    Object.assign(activeEvents, doc.activeEvents || {});
    Object.assign(activeLootPanels, doc.activeLootPanels || {});
    Object.assign(bountyThreads, doc.bountyThreads || {});
    Object.assign(bountyLinks, doc.bountyLinks || {});
    Object.assign(bountyLinkRequests, doc.bountyLinkRequests || {});
    Object.assign(bountyApplications, doc.bountyApplications || {});
    Object.assign(bountyEntry, doc.bountyEntry || {});
    Object.assign(rolePickMenu, doc.rolePickMenu || {});
    Object.assign(salaryMenus, doc.salaryMenus || {});
    Object.assign(bountyBoard, doc.bountyBoard || {});
    digestLastSent = doc.digestLastSent || 0;
    lzDigestLastSent = doc.lzDigestLastSent || 0;
    bountyReminderLastSent = doc.bountyReminderLastSent || 0;
  }
  console.log(
    `📂 Loaded state from MongoDB: ${Object.keys(activeEvents).length} events, ${Object.keys(activeLootPanels).length} loot panels`,
  );
}

// Fire-and-forget: kicks off the write without blocking the caller.
function saveState() {
  if (!collection) return;
  collection
    .replaceOne(
      { _id: "state" },
      {
        _id: "state",
        activeEvents,
        activeLootPanels,
        bountyThreads,
        bountyLinks,
        bountyLinkRequests,
        bountyApplications,
        bountyEntry,
        rolePickMenu,
        salaryMenus,
        bountyBoard,
        digestLastSent,
        lzDigestLastSent,
        bountyReminderLastSent,
      },
      { upsert: true },
    )
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

// ── Group Bounty ─────────────────────────────────────────────────────────────
// Unlike the salary writes above, roster and quest writes are awaited: the user
// gets a "saved" confirmation, so fire-and-forget would let the bot claim a write
// that never happened. Callers check the boolean and say so when Mongo is off.

function getBountyReminderLastSent() {
  return bountyReminderLastSent;
}

function setBountyReminderLastSent(ts) {
  bountyReminderLastSent = ts;
  saveState();
}

// ── Linked accounts ──────────────────────────────────────────────────────────
// Nothing is ever moved between documents. Reads return the union of the
// group's documents and writes go back to whichever document each row came
// from, so unlinking is free and no two characters ever have to be reconciled.

const primaryOf = (userId) => bountyLinks[userId] || userId;

// The whole group, the caller included. Unlinked accounts are a group of one,
// which is what makes every path below identical whether links exist or not.
function linkedTo(userId) {
  const p = primaryOf(userId);
  const group = Object.keys(bountyLinks).filter((id) => bountyLinks[id] === p);
  return group.length ? group : [userId];
}

const incomingLinks = (userId) =>
  Object.keys(bountyLinkRequests).filter((from) => bountyLinkRequests[from] === userId);

// The invite waits on the target's own panel rather than being delivered. A DM
// can be closed and a public message would announce someone's alt to the guild
// — the one thing a second account is usually for.
function requestLink(fromId, toId) {
  if (fromId === toId) return "Itu akun yang sama.";
  if (primaryOf(fromId) === primaryOf(toId) && bountyLinks[fromId]) return "Kalian sudah ter-link.";
  if (bountyLinks[toId]) return "Akun itu sudah ter-link ke grup lain.";
  bountyLinkRequests[fromId] = toId;
  saveState();
  return null;
}

function cancelLink(fromId) {
  delete bountyLinkRequests[fromId];
  saveState();
}

function approveLink(fromId, toId) {
  if (bountyLinkRequests[fromId] !== toId) return false;
  const p = primaryOf(fromId);
  // Everyone already with `from`, plus the newcomer, now points at one primary.
  for (const id of [...linkedTo(fromId), toId]) bountyLinks[id] = p;
  delete bountyLinkRequests[fromId];
  saveState();
  return true;
}

// Leaving a group never needs anyone's permission — it takes nothing away from
// the people who stay, and their links to each other are untouched.
function unlink(userId) {
  const rest = linkedTo(userId).filter((id) => id !== userId);
  delete bountyLinks[userId];
  // A group of one is not a group: drop the last member's entry too, so
  // `linkedTo` keeps answering with a bare [userId] rather than a stale pair.
  if (rest.length === 1) delete bountyLinks[rest[0]];
  else if (rest.length && !rest.includes(primaryOf(rest[0])))
    for (const id of rest) bountyLinks[id] = rest[0]; // the primary left; promote
  saveState();
}

// ── Characters ───────────────────────────────────────────────────────────────
// One document per user: { _id: userId, chars: [{ name, job, dpsTier, … }] }
//
// Linked accounts read as one roster. `_owner` rides on each row so the write
// below can send it home again — it is stripped before anything is stored.
async function getChars(userId) {
  if (!charsCollection) return [];
  const group = linkedTo(userId);
  if (group.length === 1) {
    const doc = await charsCollection.findOne({ _id: userId });
    return doc?.chars || [];
  }
  return mergeChars(await charsCollection.find({ _id: { $in: group } }).toArray());
}

// Pure, and exported so it can be checked without a database — losing or
// duplicating a character here is silent, and Mongo is the one part of this
// that a test cannot watch.
const mergeChars = (docs) =>
  docs.flatMap((d) => (d.chars || []).map((c) => ({ ...c, _owner: d._id })));

// The other direction: every row goes home to the document it came from, and a
// row with no home belongs to whoever is acting. Every member is written, so a
// character removed here also leaves the document it actually lived in.
function splitChars(group, chars, actor) {
  const byOwner = new Map(group.map((id) => [id, []]));
  for (const c of chars) {
    const { _owner, ...rest } = c;
    byOwner.get(byOwner.has(_owner) ? _owner : actor).push(rest);
  }
  return byOwner;
}

// Replaces the whole array. Callers read → mutate → save, which keeps the
// planner's fields on each character intact because they were never dropped.
//
// With a group, one save rewrites every member's document: a character added
// here belongs to the account doing the adding, and one moved or removed has to
// disappear from the document it actually lived in.
async function saveChars(userId, chars) {
  if (!charsCollection) return false;
  const group = linkedTo(userId);
  if (group.length === 1) {
    await charsCollection.replaceOne({ _id: userId }, { _id: userId, chars }, { upsert: true });
    return true;
  }
  const byOwner = splitChars(group, chars, userId);
  await Promise.all(
    [...byOwner].map(([id, list]) =>
      charsCollection.replaceOne({ _id: id }, { _id: id, chars: list }, { upsert: true }),
    ),
  );
  return true;
}

// Every registered character, for the matcher. Characters that entered no quests
// still matter — they hold all 6 claims and are exactly who should fill seats.
// At ~50 documents this is a full scan by design; nothing here needs an index.
async function getAllChars() {
  if (!charsCollection) return [];
  return charsCollection.find({}).toArray();
}

// One document per user per week. Never read once its week has passed, so there
// is nothing to reset and nothing a restart can miss.
//
// Linked accounts read as one week, on the same `_owner` tag the roster uses. A
// character's quests must all sit in ONE document or the six-quest cap would be
// counted against a partial view and could be exceeded.
const qsig = (q) => `${q.poolKey}|${q.rarity}|${q.scroll}|${q.box ? 1 : 0}`;

async function getBountyWeek(userId, weekKey) {
  if (!bountyWeekCollection) return null;
  const group = linkedTo(userId);
  if (group.length === 1) return bountyWeekCollection.findOne({ _id: `${userId}:${weekKey}` });

  const docs = await bountyWeekCollection
    .find({ _id: { $in: group.map((id) => `${id}:${weekKey}`) } })
    .toArray();
  if (!docs.length) return null;

  return { _id: `${userId}:${weekKey}`, owners: group, weekKey, chars: mergeWeek(docs) };
}

function mergeWeek(docs) {
  const chars = {};
  for (const d of docs) {
    const owner = d.owners?.[0] || String(d._id).split(":")[0];
    for (const [name, cw] of Object.entries(d.chars || {})) {
      if (!chars[name]) {
        chars[name] = { ...cw, board: [...(cw.board || [])], shares: [...(cw.shares || [])], _owner: owner };
        continue;
      }
      // The same character name registered on two accounts BEFORE they linked.
      // Merge rather than pick, and the next save lands it all in one document —
      // a character's quests must sit in ONE document or the six-quest cap gets
      // counted against a partial view and can be exceeded.
      const seen = new Set(chars[name].board.map(qsig));
      for (const q of cw.board || []) if (!seen.has(qsig(q))) chars[name].board.push(q);
      chars[name].shares.push(...(cw.shares || []));
    }
  }
  return chars;
}

function splitWeek(group, chars, actor) {
  const byOwner = new Map(group.map((id) => [id, {}]));
  for (const [name, cw] of Object.entries(chars || {})) {
    const { _owner, ...rest } = cw;
    byOwner.get(byOwner.has(_owner) ? _owner : actor)[name] = rest;
  }
  return byOwner;
}

async function saveBountyWeek(doc) {
  if (!bountyWeekCollection) return false;
  const actor = String(doc._id).split(":")[0];
  const group = linkedTo(actor);
  if (group.length === 1) {
    await bountyWeekCollection.replaceOne({ _id: doc._id }, doc, { upsert: true });
    return true;
  }

  const byOwner = splitWeek(group, doc.chars, actor);
  await Promise.all(
    [...byOwner].map(([id, chars]) =>
      bountyWeekCollection.replaceOne(
        { _id: `${id}:${doc.weekKey}` },
        { _id: `${id}:${doc.weekKey}`, owners: [id], weekKey: doc.weekKey, chars },
        { upsert: true },
      ),
    ),
  );
  return true;
}

// Every user's quests for one week — the matcher's only read.
async function getBountyWeekAll(weekKey) {
  if (!bountyWeekCollection) return [];
  return bountyWeekCollection.find({ weekKey }).toArray();
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
  bountyThreads,
  bountyEntry,
  rolePickMenu,
  salaryMenus,
  bountyLinks,
  bountyLinkRequests,
  bountyApplications,
  primaryOf,
  linkedTo,
  mergeChars,
  splitChars,
  mergeWeek,
  splitWeek,
  requestLink,
  cancelLink,
  approveLink,
  unlink,
  incomingLinks,
  bountyBoard,
  getBountyReminderLastSent,
  setBountyReminderLastSent,
  getChars,
  saveChars,
  getAllChars,
  getBountyWeek,
  saveBountyWeek,
  getBountyWeekAll,
  setPendingEphemeral,
  clearPendingEphemeral,
  setPendingResolution,
  takePendingResolution,
};
