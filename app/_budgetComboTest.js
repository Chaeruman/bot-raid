// Run: node app/_budgetComboTest.js — checks the "best ≤3-member combo under
// budget" recommendation used by /kirim-gaji's budget option.
const assert = require("assert");
const { bestComboUnderBudget, cheapestComboTotal } = require("./handlers/commands/combinedPay");

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

// Mail tax (0.3%) is applied to the raw budget before searching — same math
// combinedPay.js's buildUnpaidView does (Math.floor(budget * (1 - 0.003))).
const MAIL_TAX_RATE = 0.003;
const rawBudget = 100000;
const effectiveBudget = Math.floor(rawBudget * (1 - MAIL_TAX_RATE));
assert.strictEqual(effectiveBudget, 99700);
best = bestComboUnderBudget(agg, uids, effectiveBudget, 3);
assert.ok(best.total <= effectiveBudget); // never recommends more than what's actually sendable

// Headcount is maximized first: a 3-person combo that fits is preferred over
// a 2-person (or 1-person) combo even if the smaller combo's total is just
// as close to budget — an unused mail slot is wasted capacity.
const agg2 = { a: { total: 100 }, b: { total: 140 }, c: { total: 150 }, d: { total: 390 } };
const uids2 = Object.keys(agg2);
best = bestComboUnderBudget(agg2, uids2, 400, 3);
assert.strictEqual(best.uids.length, 3); // a+b+c=390, not d alone (also 390)
assert.strictEqual(best.total, 390);

// cheapestComboTotal: minimum budget (before tax) needed to unlock a combo
// of exactly `count` people — the number shown in the "naikin budget ke
// minimal X" suggestion.
assert.strictEqual(cheapestComboTotal(agg, uids, 3), 100 + 250 + 300); // a+b+c, the cheapest 3
assert.strictEqual(cheapestComboTotal(agg, uids, 1), 100); // cheapest single
assert.strictEqual(cheapestComboTotal(agg2, uids2, 3), 100 + 140 + 150); // a+b+c

console.log("✅ bestComboUnderBudget OK");
