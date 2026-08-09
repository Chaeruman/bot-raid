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

  // --- Grouping: panel count on top, seller IGN list underneath -------------
  // Four panels on two characters. u1 is owed by three, u2 by the two
  // "santenaz" ones, u3 and u4 by one each — on DIFFERENT characters, so the
  // single "1 Panel" header carries two IGN sub-blocks.
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
  state.activeLootPanels.g4 = panel("g4", "santenaz", ["u4"]);

  const grouped = await buildUnpaidView(fakeClient, fakeGuild, "seller");
  // Only the member list — the "**Panel:**" link block below it opens its lines
  // with the same • bullet and would be counted as member rows.
  const listPart = grouped.content.split("**Panel:**")[0].trimEnd();
  // Names come back as the raw uid from the fake guild — no " - " alias in
  // them, so every row also carries the ⚠️ "that's not their IGN" flag.
  assert.deepStrictEqual(
    listPart.split("\n").filter((l) => /^(\*\*\d+ Panel|\[|[•⭐])/.test(l)),
    [
      "**3 Panel**", // one header per count, printed once
      "[ santenaz | chelssea ]", // u1 — three panels across two characters
      "•⚠️ (u1) (bukan IGN mereka) — 294g\\_balance",
      "**2 Panel**",
      "[ santenaz ]", // u2 — two panels, but only ONE character
      "•⚠️ (u2) (bukan IGN mereka) — 196g\\_balance",
      "**1 Panel**", // …and one count header covering TWO IGN blocks
      "[ chelssea ]",
      "•⚠️ (u3) (bukan IGN mereka) — 98g\\_balance",
      "[ santenaz ]",
      "•⚠️ (u4) (bukan IGN mereka) — 98g\\_balance",
    ],
  );

  // A blank line before every sub-block, or the next "[ ... ]" reads as one
  // more member of the block above it.
  assert.ok(
    listPart.includes("98g\\_balance\n\n[ santenaz ]"),
    `no blank line before the second sub-block:\n${listPart}`,
  );

  // Member rows carry no count and no bracket any more — both moved up.
  const rows = listPart.split("\n").filter((l) => /^[•⭐]/.test(l));
  assert.strictEqual(rows.length, 4);
  assert.ok(rows.every((l) => !/\(\d+ panel\)/.test(l)), `count leaked into a row: ${rows}`);
  assert.ok(rows.every((l) => !/\[/.test(l)), `IGN bracket leaked into a row: ${rows}`);

  for (const id of ["g1", "g2", "g3", "g4"]) delete state.activeLootPanels[id];

  console.log("✅ buildUnpaidView truncation + partial-assign refresh shape OK");
})();
