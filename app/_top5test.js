// Run: node app/_top5test.js — checks top-5 highest-total-per-panel ranking
// + "post only on real record" logic (same shape as salaryRecords.js's
// checkTop5Records, without needing Mongo/Discord).
const assert = require("assert");

function applyPanel(top5, panelId, amount) {
  if (top5.length >= 5 && amount <= top5[top5.length - 1].amount) return false; // doesn't crack top 5
  const before = top5.map((e) => e.panelId).join(",");
  top5.push({ panelId, amount });
  top5.sort((a, b) => b.amount - a.amount);
  top5.length = Math.min(top5.length, 5);
  return top5.map((e) => e.panelId).join(",") !== before;
}

let top5 = [];

// Filling the first 5 spots are all records.
assert.strictEqual(applyPanel(top5, "p1", 100), true);
assert.strictEqual(applyPanel(top5, "p2", 90), true);
assert.strictEqual(applyPanel(top5, "p3", 80), true);
assert.strictEqual(applyPanel(top5, "p4", 70), true);
assert.strictEqual(applyPanel(top5, "p5", 60), true);
assert.strictEqual(top5.map((e) => e.panelId).join(","), "p1,p2,p3,p4,p5");

// A panel total below the lowest recorded amount does NOT crack the top 5 → no post.
assert.strictEqual(applyPanel(top5, "p6", 50), false);
assert.strictEqual(top5.length, 5);

// A panel total beating the lowest amount DOES crack it → post, lowest drops out.
assert.strictEqual(applyPanel(top5, "p7", 65), true);
assert.deepStrictEqual(top5.map((e) => e.panelId), ["p1", "p2", "p3", "p4", "p7"]);

// A new #1 reorders the list → post.
assert.strictEqual(applyPanel(top5, "p8", 500), true);
assert.strictEqual(top5[0].panelId, "p8");

console.log("✅ top5 per-panel-total ranking + record-only-post logic OK");
