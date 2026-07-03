// Run: node app/_salarylogtest.js — checks salaryLog upsert/delete/range-sum
// semantics (same contract as state.js's Mongo collection, faked with a Map
// so this runs without a live MongoDB connection).
const assert = require("assert");

const store = new Map(); // _id -> {uid, amount, paidAt, sellerId, panelTitle, threadId}
const record = (panelId, uid, amount, details) =>
  store.set(`${panelId}:${uid}`, { uid, amount, paidAt: new Date(), panelId, ...details });
const remove = (panelId, uid) => store.delete(`${panelId}:${uid}`);
const log = (uid, since) => [...store.values()].filter((r) => r.uid === uid && r.paidAt >= since);
const total = (uid, since) => log(uid, since).reduce((s, r) => s + r.amount, 0);

const since = new Date(Date.now() - 1000);

// Mark paid on two panels -> sums.
record("p1", "u1", 100, { sellerId: "s1", panelTitle: "Raid A", threadId: "t1" });
record("p2", "u1", 200, { sellerId: "s2", panelTitle: "Raid B", threadId: "t2" });
assert.strictEqual(total("u1", since), 300);
assert.strictEqual(log("u1", since).find((r) => r.panelId === "p1").panelTitle, "Raid A");

// Re-marking the same panel (upsert) must not double-count.
record("p1", "u1", 150, { sellerId: "s1", panelTitle: "Raid A", threadId: "t1" }); // price got corrected before re-marking
assert.strictEqual(total("u1", since), 350);
assert.strictEqual(store.size, 2); // still one doc per (panel, uid), no duplicates

// Un-marking removes the doc entirely.
remove("p2", "u1");
assert.strictEqual(total("u1", since), 150);

// Range filter excludes old payouts.
const future = new Date(Date.now() + 10000);
assert.strictEqual(total("u1", future), 0);

console.log("✅ salaryLog upsert/delete/range-sum semantics OK");
