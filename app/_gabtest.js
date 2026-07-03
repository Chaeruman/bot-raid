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

assert.deepStrictEqual(agg.a, { total: 200, count: 2 }); // excluded from ÷7 both panels
assert.deepStrictEqual(agg.b, { total: 200, count: 1 });
assert.deepStrictEqual(agg.c, { total: 200, count: 1 });
console.log("✅ combined-pay aggregate + HC-exclusion OK");

// myPanels() must skip archived/locked threads and dead threads.
(async () => {
  state.activeLootPanels.p1 = { lootMsgId: "p1", sellerId: "seller", closed: false, threadId: "t-open" };
  state.activeLootPanels.p2 = { lootMsgId: "p2", sellerId: "seller", closed: false, threadId: "t-archived" };
  state.activeLootPanels.p3 = { lootMsgId: "p3", sellerId: "seller", closed: false, threadId: "t-locked" };
  state.activeLootPanels.p4 = { lootMsgId: "p4", sellerId: "seller", closed: false, threadId: "t-deleted" };

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
  assert.deepStrictEqual(open.map((p) => p.lootMsgId), ["p1"]);
  console.log("✅ myPanels skips archived/locked/deleted threads");
})();
