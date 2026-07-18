// Run: node app/_unpaidViewTest.js — checks buildUnpaidView() truncation +
// null-when-empty, and the partial-assign refresh flow shape.
const assert = require("assert");
const { buildUnpaidView } = require("./handlers/commands/combinedPay");
const state = require("./state");

const fakeGuild = {
  id: "g1",
  members: { fetch: async (uid) => ({ displayName: uid }) },
};
const fakeClient = { channels: { fetch: async () => ({ archived: false, locked: false }) } };

(async () => {
  // No panels at all -> null.
  assert.strictEqual(await buildUnpaidView(fakeClient, fakeGuild, "nobody"), null);

  // One panel, one unpaid member -> a view with a select row.
  state.activeLootPanels.pv1 = {
    lootMsgId: "pv1",
    sellerId: "seller",
    closed: false,
    threadId: "t1",
    eventTitle: "Test Panel",
    items: [{ itemKey: "gdn_fragment", qty: 1, price: 800 }],
    goldEntries: [],
    members: ["u1"],
    payments: {},
  };
  const view = await buildUnpaidView(fakeClient, fakeGuild, "seller");
  assert.ok(view.content.length <= 2000);
  assert.strictEqual(view.components.length, 2); // select row + "cek budget" button row
  assert.strictEqual(view.components[0].components[0].data.custom_id, "gab:seller");
  assert.strictEqual(view.components[1].components[0].data.custom_id, "gab-budget:seller");

  // With a budget that fits -> a third button ("Mark Paid Rekomendasi") shows
  // up first in the second row, ahead of the budget button.
  const viewWithBudget = await buildUnpaidView(fakeClient, fakeGuild, "seller", 100000);
  assert.strictEqual(viewWithBudget.components[1].components.length, 2);
  assert.strictEqual(viewWithBudget.components[1].components[0].data.custom_id, "gab-paid-rec:seller:100000");
  assert.strictEqual(viewWithBudget.components[1].components[1].data.custom_id, "gab-budget:seller");

  // All paid -> back to null (matches the "everyone's done" branch).
  state.activeLootPanels.pv1.payments.u1 = true;
  assert.strictEqual(await buildUnpaidView(fakeClient, fakeGuild, "seller"), null);

  console.log("✅ buildUnpaidView truncation + partial-assign refresh shape OK");
})();
