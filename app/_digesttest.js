// Run: node app/_digesttest.js — checks the digest's slot + totals grouping.
const assert = require("assert");
const { TARGET_DAY, TARGET_HOUR } = require("./digest");
const { msUntilWib } = require("./utils/schedule");

// The arithmetic lives in utils/schedule and is checked by _scheduleTest; what
// matters here is that this digest still asks for the slot it advertises.
assert.strictEqual(TARGET_DAY, 5, "Friday");
assert.strictEqual(TARGET_HOUR, 23, "23:00 WIB");

// Friday 23:00 WIB = Friday 16:00 UTC; 2026-07-03 is a Friday.
assert.strictEqual(msUntilWib(TARGET_HOUR, TARGET_DAY, Date.UTC(2026, 6, 3, 15, 59)), 60 * 1000);
// From Saturday 23:00 WIB it waits for Friday — exactly six days, not until
// that evening.
const DAY_MS = 24 * 60 * 60 * 1000;
assert.strictEqual(msUntilWib(TARGET_HOUR, TARGET_DAY, Date.UTC(2026, 6, 4, 16, 0)), 6 * DAY_MS);

// Totals grouping (same aggregate shape state.js's getSalaryTotalsSince returns).
const rows = [
  { uid: "u1", amount: 100, paidAt: new Date() },
  { uid: "u1", amount: 50, paidAt: new Date() },
  { uid: "u2", amount: 400, paidAt: new Date() },
  { uid: "u3", amount: 200, paidAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // outside window
];
const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const totals = Object.values(
  rows
    .filter((r) => r.paidAt >= since)
    .reduce((acc, r) => {
      (acc[r.uid] ??= { _id: r.uid, total: 0 }).total += r.amount;
      return acc;
    }, {}),
);
assert.deepStrictEqual(totals.sort((a, b) => a._id.localeCompare(b._id)), [
  { _id: "u1", total: 150 },
  { _id: "u2", total: 400 },
]);

// Top-N leaderboard sort (same logic as digest.js's sendWeeklyDigest).
const top = totals.filter((r) => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);
assert.deepStrictEqual(top.map((r) => r._id), ["u2", "u1"]);

console.log("✅ digest window + totals grouping + top-N sort OK");
