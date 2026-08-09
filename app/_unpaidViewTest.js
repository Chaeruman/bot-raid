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
  delete state.activeLootPanels.pv1;

  // --- Grouping: one header per (panel count + seller IGN set) --------------
  // Three panels on two characters. u1 is owed by all three, u2 by the two
  // "santenaz" ones, u3 by one "chelssea" one. u2 and u3 share a count only in
  // the "2 panel" sense if the IGNs match — they don't, so they never merge.
  const panel = (id, ign, members) => ({
    lootMsgId: id,
    sellerId: "seller",
    closed: false,
    threadId: `t_${id}`,
    eventTitle: "Test Panel",
    sellerIgn: ign,
    items: [{ itemKey: "gdn_fragment", qty: 1, price: 800 }],
    goldEntries: [],
    members,
    payments: {},
  });
  state.activeLootPanels.g1 = panel("g1", "santenaz", ["u1", "u2"]);
  state.activeLootPanels.g2 = panel("g2", "santenaz", ["u1", "u2"]);
  state.activeLootPanels.g3 = panel("g3", "chelssea", ["u1", "u3"]);

  const grouped = await buildUnpaidView(fakeClient, fakeGuild, "seller");
  // Only the member list — the "**Panel:**" link block below it opens its lines
  // with the same • bullet and would be counted as member rows.
  const listPart = grouped.content.split("**Panel:**")[0];
  const headers = listPart.split("\n").filter((l) => /^\*\*\d+ Panel\*\*/.test(l));
  assert.deepStrictEqual(headers, [
    "**3 Panel** - [ santenaz | chelssea ]", // u1 — three panels, two characters
    "**2 Panel** - [ santenaz ]", // u2 — two panels, but only ONE character
    "**1 Panel** - [ chelssea ]", // u3
  ]);

  // Member rows carry no count and no bracket any more — that moved to the header.
  const rows = listPart.split("\n").filter((l) => /^[•⭐]/.test(l));
  assert.strictEqual(rows.length, 3);
  assert.ok(rows.every((l) => !/\(\d+ panel\)/.test(l)), `count leaked into a row: ${rows}`);
  assert.ok(rows.every((l) => !/\[/.test(l)), `IGN bracket leaked into a row: ${rows}`);

  for (const id of ["g1", "g2", "g3"]) delete state.activeLootPanels[id];

  console.log("✅ buildUnpaidView truncation + partial-assign refresh shape OK");
})();
