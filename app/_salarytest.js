// Run: node app/_salarytest.js — checks 0.3% mail tax + exact-before-includes tag matching.
const assert = require("assert");
const { memberSalary } = require("./builders/lootPanel");

// 800 item net + 800 gold ÷8 → gross 200/person; ×0.997 floored.
const panel = {
  items: [],
  goldEntries: [
    { amount: 1600, splitCount: 8 },
    { amount: 700, splitCount: 7, excludedUserId: "a" },
  ],
};
// gross(normal) = floor(1600/8) + floor(700/7) = 200 + 100 = 300 → ×0.997 = 299.1 → 299
assert.strictEqual(memberSalary(panel, null), 299);
// gross(excluded "a") = 200 only (no ÷7 share) → ×0.997 = 199.4 → 199
assert.strictEqual(memberSalary(panel, "a"), 199);
console.log("✅ 0.3% mail tax applied + floored, both normal and HC-excluded");

// stampRate: old panels (no field) still use 4g/stamp; new panels use their snapshotted rate.
const { CATALOG } = require("./items");
const someKey = Object.keys(CATALOG).find((k) => CATALOG[k].stampsPerUnit > 0);
const stamps = CATALOG[someKey].stampsPerUnit;
const itemPanel = (stampRate) => ({
  items: [{ itemKey: someKey, qty: 1, price: 10000, detail: null }],
  goldEntries: [],
  stampRate,
});
const oldPanelNet = 10000 - stamps * 4;
const newPanelNet = 10000 - stamps * 5;
assert.strictEqual(memberSalary(itemPanel(undefined), null), Math.floor(Math.floor(oldPanelNet / 8) * 0.997));
assert.strictEqual(memberSalary(itemPanel(5), null), Math.floor(Math.floor(newPanelNet / 8) * 0.997));
console.log("✅ stampRate: undefined (old panels) = 4g/stamp, explicit rate honored for new panels");

// exact-before-includes tag match: "@ol" must hit "ol", not "NOLtiga".
const nameOf = { u1: "ol", u2: "NOLtiga" };
const excludeName = "ol";
const exact = Object.keys(nameOf).filter((uid) => nameOf[uid].toLowerCase() === excludeName);
const hits = exact.length ? exact : Object.keys(nameOf).filter((uid) => nameOf[uid].toLowerCase().includes(excludeName));
assert.deepStrictEqual(hits, ["u1"]);
console.log("✅ exact match wins over substring match for @tag");

// ── "nobody is excluded" is not a member id ──────────────────────────────────
// The headline figure is computed with uid = null, and an entry excluding
// nobody was STORED as excludedUserId: null — so `g.excludedUserId !== uid`
// read null !== null and dropped every ÷7 gold drop that had no exclusion,
// which is most of them. The panel listed the gold, the formula printed it, and
// nobody was paid it. The case at the top only ever passed because its entry
// names someone.
const { salaryPerPerson, buildLootEmbed, STAMP_RATE_GOLD } = require("./builders/lootPanel");

const goldPanel = (excludedUserId) => ({
  lootMsgId: "p", threadId: "t", eventTitle: "GDN", hostId: "h",
  members: ["a", "b"], sellerId: "a", payments: {}, closed: false,
  stampRate: STAMP_RATE_GOLD,
  items: [
    { itemKey: "gdn_u_accessory", qty: 1, price: 225 }, // 20 stamps
    { itemKey: "eq_gdn_galero", qty: 1, price: 35 },    //  1 stamp
    { itemKey: "gdn_fragment", qty: 2, price: 90 },     //  2 stamps, price is the total
  ],
  goldEntries: [{ amount: 258, splitCount: 7, excludedUserId }],
});

// 350 - (23 x 5) = 235 -> /8 = 29, plus 258/7 = 36 -> 65, -0.3% = 64.
for (const stored of [undefined, null]) {
  assert.strictEqual(salaryPerPerson(goldPanel(stored)), 64, `headline, excludedUserId=${stored}`);
  assert.strictEqual(memberSalary(goldPanel(stored), "a"), 64, `member, excludedUserId=${stored}`);
}
assert.strictEqual(memberSalary(goldPanel("b"), "b"), 28, "the named member loses that share");
assert.strictEqual(memberSalary(goldPanel("b"), "a"), 64, "and nobody else does");
console.log("✅ a divided-by-7 gold drop with nobody excluded is still paid");

// ── Per-member bonus gold ────────────────────────────────────────────────────
// A manual top-up for one member, for when the game's own 36g mail never
// arrived. It must reach that member and NOBODY else — the headline figure and
// everyone's salary have to be untouched, or a compensation quietly becomes a
// raise for the whole party.
const bonusPanel = (bonuses) => ({ ...goldPanel(null), bonuses });

assert.strictEqual(memberSalary(bonusPanel({ b: 36 }), "b"), 100, "the named member gets it");
assert.strictEqual(memberSalary(bonusPanel({ b: 36 }), "a"), 64, "and nobody else does");
assert.strictEqual(salaryPerPerson(bonusPanel({ b: 36 })), 64, "the headline stays the headline");
// Taxed like every other component, because it goes out in the same mail:
// gross 65 + 36 = 101 → x0.997 = 100.6 → 100.
assert.strictEqual(memberSalary(bonusPanel({ b: 36 }), "b"), Math.floor((65 + 36) * 0.997));
// Panels that predate the feature have no `bonuses` field at all.
assert.strictEqual(memberSalary(goldPanel(null), "a"), 64, "an old panel is unaffected");
assert.strictEqual(memberSalary(bonusPanel({}), "a"), 64, "so is an empty bonus map");
// Excluded from HC *and* owed a bonus is one member with two adjustments.
const both = { ...goldPanel("b"), bonuses: { b: 36 } };
assert.strictEqual(memberSalary(both, "b"), Math.floor((29 + 36) * 0.997), "both adjustments apply");
console.log("✅ bonus gold reaches one member only, taxed like the rest");

// Invisible money is the failure mode here: the summary has to name anyone who
// is not paid the headline, and say why.
const bonusSummary = buildLootEmbed(bonusPanel({ b: 36 })).data.fields.find((f) => f.name.includes("Summary")).value;
assert.ok(bonusSummary.includes("+36 bonus"), `the bonus is named: ${bonusSummary}`);
assert.ok(bonusSummary.includes("100"), `and the resulting salary shown: ${bonusSummary}`);
const bothSummary = buildLootEmbed(both).data.fields.find((f) => f.name.includes("Summary")).value;
assert.ok(
  bothSummary.includes("tidak dapat HC") && bothSummary.includes("+36 bonus"),
  `both reasons on one line: ${bothSummary}`,
);
// One line per member, not one per reason — "b" appears once however many
// adjustments they carry.
assert.strictEqual((bothSummary.match(/Gaji <@b>/g) || []).length, 1, bothSummary);
console.log("✅ the summary names every member paid off-headline, with the reason");

// A panel with nothing but a bonus is still a real payout, so Mark Paid has to
// appear — otherwise the seller has no way to send it.
const { allItemsSold: sold } = require("./builders/lootPanel");
assert.strictEqual(sold({ items: [], goldEntries: [], bonuses: { b: 36 } }), true, "bonus alone is payable");
assert.strictEqual(sold({ items: [], goldEntries: [], bonuses: {} }), false, "an empty one is not");
assert.strictEqual(sold({ items: [], goldEntries: [] }), false, "nor is a panel with no field at all");
console.log("✅ a bonus-only panel is payment-ready");

// The formula and the total come from different code paths. Disagreeing
// silently is what kept this invisible: the panel showed the gold either way.
const summary = buildLootEmbed(goldPanel(null)).data.fields.find((f) => f.name.includes("Summary")).value;
assert.ok(summary.includes("258 ÷ 7"), "the formula names the gold drop");
assert.ok(summary.includes("= **64**"), `and the total agrees with it: ${summary}`);
console.log("✅ printed formula and printed total agree");
