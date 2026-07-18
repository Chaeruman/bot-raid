// Run: node app/_budgetComboTest.js — checks the "best ≤3-member combo under
// budget" recommendation used by /kirim-gaji's budget option.
const assert = require("assert");
const { bestComboUnderBudget } = require("./handlers/commands/combinedPay");

const agg = {
  a: { total: 100 },
  b: { total: 250 },
  c: { total: 300 },
  d: { total: 400 },
};
const uids = Object.keys(agg);

// Exact-fit 2-person combo beats any 1-person combo, even if a 3rd would overflow.
// a+c = 400 fits budget 400; b+d = 650 doesn't; best single is d=400 (tie with a+c).
let best = bestComboUnderBudget(agg, uids, 400);
assert.strictEqual(best.total, 400);

// Budget below the cheapest member -> nothing fits.
assert.strictEqual(bestComboUnderBudget(agg, uids, 50), null);

// Budget big enough for all 4, but capped at 3 people (mail limit) -> picks
// the 3 highest that still fit, not all 4.
best = bestComboUnderBudget(agg, uids, 10000, 3);
assert.strictEqual(best.uids.length, 3);
assert.strictEqual(best.total, 250 + 300 + 400); // b+c+d, the 3 largest

// Budget just under the sum of the 3 biggest -> falls back to a smaller combo.
best = bestComboUnderBudget(agg, uids, 900); // b+c+d=950 too much
assert.ok(best.total <= 900);
assert.ok(best.total > 0);

console.log("✅ bestComboUnderBudget OK");
