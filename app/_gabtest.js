// Run: node app/_gabtest.js  — checks combined-pay aggregation across panels.
const assert = require("assert");
const { aggregate, myPanels } = require("./handlers/commands/combinedPay");
const state = require("./state");

// Panel: 800g ÷8 (=100 base each) + 700g ÷7 (=100 HC each, a is excluded).
const gold = [
  { amount: 800, splitCount: 8 },
  { amount: 700, splitCount: 7, excludedUserId: "a" },
];
const panel = (members, payments) => ({ items: [], goldEntries: gold, members, payments });

const agg = aggregate([
  panel(["a", "b"], {}),            // a: base only 100; b: 100+100=200
  panel(["a", "c"], { a: false }),  // a: 100; c: 200
  panel(["b"], { b: true }),        // b paid → skipped
]);

// Totals are post-0.3%-mail-tax: 100 → 99, 200 → 199.
// panelNums are 1-based indexes into the panels array, used for the clickable
// per-member panel links in the /kirim-gaji reply.
assert.deepStrictEqual(agg.a, { total: 198, panelNums: [1, 2] }); // excluded from ÷7 both panels
assert.deepStrictEqual(agg.b, { total: 199, panelNums: [1] });
assert.deepStrictEqual(agg.c, { total: 199, panelNums: [2] });
console.log("✅ combined-pay aggregate + HC-exclusion + panelNums OK");

// myPanels() must skip archived/locked threads and dead threads.
(async () => {
  const mk = (id, threadId, extra) => ({ lootMsgId: id, sellerId: "seller", closed: false, threadId, items: [], goldEntries: [], ...extra });
  const priced = { items: [{ price: 100 }] };

  state.activeLootPanels.p1 = mk("p1", "t-open", priced);
  state.activeLootPanels.p2 = mk("p2", "t-archived", priced);
  state.activeLootPanels.p3 = mk("p3", "t-locked", priced);
  state.activeLootPanels.p4 = mk("p4", "t-deleted", priced);
  state.activeLootPanels.p5 = mk("p5", "t-open", { items: [{ price: null }] }); // still being priced
  // Nothing to pay out yet — must not surface in /kirim-gaji with a 0g salary.
  state.activeLootPanels.p6 = mk("p6", "t-open");                                        // no items, no gold
  state.activeLootPanels.p7 = mk("p7", "t-open", { items: [{ price: null, notForSale: true }] }); // gacha-only
  // Raw gold with no items at all is legitimately payable.
  state.activeLootPanels.p8 = mk("p8", "t-open", { goldEntries: [{ amount: 800, splitCount: 8 }] });

  const threads = {
    "t-open": { archived: false, locked: false },
    "t-archived": { archived: true, locked: false },
    "t-locked": { archived: false, locked: true },
  };
  const fakeClient = {
    channels: {
      fetch: async (id) => {
        if (!threads[id]) throw new Error("unknown channel");
        return threads[id];
      },
    },
  };

  const open = await myPanels(fakeClient, "seller");
  assert.deepStrictEqual(open.map((p) => p.lootMsgId), ["p1", "p8"]);
  console.log("✅ myPanels skips archived/locked/deleted threads, and panels still being priced (p5)");
  console.log("✅ myPanels skips panels with nothing to pay out — empty (p6) and gacha-only (p7) — but keeps gold-only (p8)");
})();
