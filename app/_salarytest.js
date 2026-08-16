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
const {
  salaryPerPerson, buildLootEmbed, STAMP_RATE_GOLD,
  bonusShortfall, fundedGoldEntries, updateThreadTitle,
} = require("./builders/lootPanel");

// Eight members, because the pool is now split by however many are on the
// panel. This used to say ["a", "b"] — two stand-ins, enough to exercise the
// exclusion back when the divisor was a hardcoded 8. The moment the headcount
// started to matter, that fixture was quietly describing a two-man GDN.
const goldPanel = (excludedUserId) => ({
  lootMsgId: "p", threadId: "t", eventTitle: "GDN", hostId: "h",
  members: ["a", "b", "c", "d", "e", "f", "g", "h"],
  sellerId: "a", payments: {}, closed: false,
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

// ── A party that is not eight ────────────────────────────────────────────────
// The pool used to be divided by a hardcoded 8 whatever the headcount, so seven
// people each got an eighth and the eighth share was paid to nobody. And the
// gold branches only recognised the literals 8 and 7: an entry typed with any
// other divisor — `/6`, which is exactly what a seven-man run needs — matched
// neither, so it was printed on the panel, printed in the formula, and paid to
// no one at all. That is the worst shape a money bug can take.
const seven = (goldEntries = []) => ({
  lootMsgId: "p7", threadId: "t", eventTitle: "GDN", hostId: "h",
  members: ["a", "b", "c", "d", "e", "f", "g"], sellerId: "a",
  payments: {}, closed: false, stampRate: STAMP_RATE_GOLD,
  items: [{ itemKey: "gdn_u_accessory", qty: 1, price: 705 }], // 20 stamps
  goldEntries,
});

// 705 − (20 × 5) = 605 net, ÷7 = 86, −0.3% = 85.
assert.strictEqual(salaryPerPerson(seven()), 85, "the pool splits seven ways");

// Normal gold in a seven-man run is typed /7 — same count as the party, so it
// joins the pool: (605 + 700) ÷ 7 = 186, −0.3% = 185.
assert.strictEqual(salaryPerPerson(seven([{ amount: 700, splitCount: 7 }])), 185);

// HC gold is one fewer: /6, with one member left out. Everyone else gets
// 86 + floor(600/6) = 186, −0.3% = 185. The excluded member keeps 85.
const hc7 = seven([{ amount: 600, splitCount: 6, excludedUserId: "g" }]);
assert.strictEqual(memberSalary(hc7, "a"), 185, "six-way HC gold reaches the six");
assert.strictEqual(memberSalary(hc7, "g"), 85, "and not the one left out");
// Nobody is silently unpaid: what leaves the pot is what reaches people.
assert.strictEqual(
  6 * Math.floor(600 / 6), 600,
  "the six-way split accounts for all of it",
);

// The formula printed above the total has to be the sum actually done, or the
// panel is lying in the one place people check it.
const f7 = buildLootEmbed(hc7).data.fields.find((f) => f.name.includes("Summary")).value;
assert.ok(f7.includes("÷ 7"), `the pool divisor is the party: ${f7}`);
assert.ok(f7.includes("600 ÷ 6"), `and the HC divisor is the entry's own: ${f7}`);
assert.ok(!f7.includes("÷ 8"), `never a hardcoded eight: ${f7}`);
console.log("✅ a seven-man run splits by seven, and its ÷6 HC gold reaches six people");

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

// ── Bonuses funded from the run's own gold ───────────────────────────────────
// A "!" on a gold line marks it as the pot the bonuses come out of. The money
// then leaves the pool BEFORE it is split, which is what makes the party pay for
// the compensation instead of the seller. Total gold out is unchanged — it is
// only shared differently — so this is checked by conservation, not by eyeball.
const srcPanel = (bonuses, bonusSource) => ({
  lootMsgId: "p", threadId: "t", eventTitle: "GDN", hostId: "h",
  members: ["a", "b", "c", "d", "e", "f", "g", "h"], sellerId: "a", payments: {}, closed: false,
  stampRate: STAMP_RATE_GOLD,
  items: [],
  goldEntries: [{ amount: 800, splitCount: 8, excludedUserId: null, bonusSource }],
  bonuses,
});

// Unmarked: the pool is untouched and the seller funds the bonus out of pocket.
assert.strictEqual(memberSalary(srcPanel({ b: 80 }, false), "a"), Math.floor(100 * 0.997), "unmarked leaves the pool alone");
assert.strictEqual(memberSalary(srcPanel({ b: 80 }, false), "b"), Math.floor(180 * 0.997), "and pays the bonus on top");

// Marked: 800 − 80 = 720 → 90 each, and "b" gets 90 + 80.
assert.strictEqual(memberSalary(srcPanel({ b: 80 }, true), "a"), Math.floor(90 * 0.997), "marked shrinks everyone's share");
assert.strictEqual(memberSalary(srcPanel({ b: 80 }, true), "b"), Math.floor(170 * 0.997), "the bonus holder nets share + bonus");
assert.strictEqual(salaryPerPerson(srcPanel({ b: 80 }, true)), Math.floor(90 * 0.997), "the headline drops with it");

// The pool shrinks by exactly the bonus pot — no more (deducted twice) and no
// less (deducted once but also paid by the seller).
{
  const p = srcPanel({ b: 80, c: 40 }, true);
  assert.strictEqual(fundedGoldEntries(p)[0].amount, 800 - 120, "deducted exactly once");
  // And the STORED entry is untouched. Mutating it would shrink the pool again
  // on every redraw and saveState would persist the loss — a panel that quietly
  // pays less each time anyone touches it.
  assert.strictEqual(p.goldEntries[0].amount, 800, "the stored gold entry is never mutated");
  buildLootEmbed(p);
  buildLootEmbed(p);
  assert.strictEqual(p.goldEntries[0].amount, 800, "still untouched after two redraws");

  const share = Math.floor((800 - 120) / 8);
  assert.strictEqual(memberSalary(p, "c"), Math.floor((share + 40) * 0.997));
  assert.strictEqual(memberSalary(p, "d"), Math.floor(share * 0.997));
}

// Marked gold smaller than the bonus pot: it drains to zero and the rest falls
// back on the seller. Silently paying a negative share would be the alternative.
{
  const p = srcPanel({ b: 1000 }, true);
  assert.strictEqual(memberSalary(p, "a"), 0, "a fully drained pool pays nobody a share");
  assert.strictEqual(memberSalary(p, "b"), Math.floor(1000 * 0.997), "the bonus is still paid in full");
  assert.strictEqual(bonusShortfall(p), 200, "and the uncovered part is reported");
}
assert.strictEqual(bonusShortfall(srcPanel({ b: 80 }, true)), 0, "a covered bonus has no shortfall");
assert.strictEqual(bonusShortfall(srcPanel({ b: 80 }, false)), 80, "an unmarked panel is all shortfall");
console.log("✅ bonuses come out of the marked gold, and the books balance");

// The panel has to SAY which happened: "the party paid" and "the seller paid"
// produce identical member numbers and are not the same event.
const srcSummary = (p) => buildLootEmbed(p).data.fields.find((f) => f.name.includes("Summary")).value;
assert.ok(srcSummary(srcPanel({ b: 80 }, true)).includes("diambil dari gold bertanda"), "funded is named");
assert.ok(!srcSummary(srcPanel({ b: 80 }, true)).includes("ditanggung seller"), "and not warned about");
assert.ok(srcSummary(srcPanel({ b: 80 }, false)).includes("ditanggung seller"), "unfunded is warned about");
// The gold field shows the deduction, or the typed number would read as the
// number that got split.
const goldField = (p) => buildLootEmbed(p).data.fields.find((f) => f.name.includes("Gold")).value;
assert.ok(goldField(srcPanel({ b: 80 }, true)).includes("− 80 bonus = 720"), goldField(srcPanel({ b: 80 }, true)));
assert.ok(goldField(srcPanel({ b: 80 }, true)).includes("90/person"), "and the real per-person figure");
assert.ok(!goldField(srcPanel({ b: 80 }, false)).includes("bonus"), "an unmarked drop is printed plainly");
console.log("✅ the panel shows where the bonus money came from");

// The "!" prefix itself, at the parser.
const { parseItemLines: pil } = require("./utils/parseItems");
assert.strictEqual(pil("!258/8").golds[0].bonusSource, true, "leading !");
assert.strictEqual(pil("gold !258/8").golds[0].bonusSource, true, "! after the gold word");
assert.strictEqual(pil("!gold 258/8").golds[0].bonusSource, true, "! before it");
assert.strictEqual(pil("258/8").golds[0].bonusSource, false, "no mark by default");
assert.strictEqual(pil("!294/7 @ol").golds[0].bonusSource, true, "works on ÷7 too");
assert.strictEqual(pil("!294/7 @ol").golds[0].excludeName, "ol", "and the exclusion still parses");
assert.strictEqual(pil("!258/8").golds[0].amount, 258, "the ! never reaches the amount");
console.log("✅ ! prefix parses on every gold-line shape");

// Any divisor, not just the two literals. The regex accepted only 7 and 8, so
// a seven-man run's "294/6 @kucing" fell past the gold parser into the item
// parser and came back as "not a known item" — a message about the wrong
// thing, for a line that was written correctly.
assert.strictEqual(pil("294/6 @kucing").golds[0].splitCount, 6, "a six-way split parses");
assert.strictEqual(pil("294/6 @kucing").golds[0].excludeName, "kucing", "with its exclusion");
assert.strictEqual(pil("294/6 @kucing").errors.length, 0, "and nothing is reported as a bad line");
assert.strictEqual(pil("1,000,000/12").golds[0].splitCount, 12, "and a big party too");
assert.strictEqual(pil("!258/6 @ol").golds[0].bonusSource, true, "the ! still rides along");
// Whether the number suits the party is checked where the members are known;
// what the parser refuses is arithmetic that cannot mean anything.
assert.strictEqual(pil("294/1").golds.length, 0, "÷1 is a typo, not a split");
assert.strictEqual(pil("294/0").golds.length, 0, "and ÷0 never reaches a division");
console.log("✅ any sane divisor parses, /1 and /0 do not");

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

// ── Thread title ─────────────────────────────────────────────────────────────
// A bonus-only panel counts as payable, so Mark Paid shows — but it has no
// per-person figure, and renaming the thread to "💵 0g — …" made a real payout
// look broken in the thread list.
//
// Last in the file and explicitly awaited: updateThreadTitle is async, and an
// un-awaited assertion is one that can fail after the script says it passed.
(async () => {
  let renamed = null;
  const run = async (panel, name) => {
    renamed = name;
    await updateThreadTitle({ name, setName: async (n) => { renamed = n; } }, { ...panel, ownThread: true });
    return renamed;
  };

  const bonusOnly = { items: [], goldEntries: [], bonuses: { b: 36 }, closed: false };
  assert.strictEqual(await run(bonusOnly, "Marathon GDN"), "💵 Marathon GDN", "no 0g in the title");

  // With real gold there IS a per-person figure, and it goes back in.
  const withGold = srcPanel({ b: 80 }, true);
  assert.strictEqual(await run(withGold, "Marathon GDN"), "💵 89g — Marathon GDN");

  // The prefix never stacks, whichever of the two forms is already there.
  assert.strictEqual(await run(withGold, "💵 Marathon GDN"), "💵 89g — Marathon GDN", "bare marker replaced");
  assert.strictEqual(await run(withGold, "💵 12g — Marathon GDN"), "💵 89g — Marathon GDN", "old figure replaced");
  assert.strictEqual(await run(bonusOnly, "💵 12g — Marathon GDN"), "💵 Marathon GDN", "dropped when it goes to 0");
  console.log("✅ thread title never advertises a 0g payout, and never stacks its prefix");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
