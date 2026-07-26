// Run: node app/_addToPanelTest.js — checks addToPanel's merge rules:
// "quantity" items (fragments) merge by note/notForSale; "unique" items
// (equipment, runes, accessories) never merge, one row per drop.
const assert = require("assert");
const { addToPanel } = require("./handlers/modals/addItems");

// "quantity" type: different notes must not merge (different buyers).
const panel = { items: [] };
addToPanel(panel, { itemKey: "gdn_fragment", qty: 1, note: "for budi" });
addToPanel(panel, { itemKey: "gdn_fragment", qty: 1, note: "for sari" });
assert.strictEqual(panel.items.length, 2, "different notes must not merge");
assert.strictEqual(panel.items[0].note, "for budi");
assert.strictEqual(panel.items[1].note, "for sari");

// "quantity" type: same note -> merges and sums qty.
addToPanel(panel, { itemKey: "gdn_fragment", qty: 2, note: "for budi" });
assert.strictEqual(panel.items.length, 2, "same note must still merge");
assert.strictEqual(panel.items[0].qty, 3);

// "quantity" type: no-note items still merge with each other.
const panel2 = { items: [] };
addToPanel(panel2, { itemKey: "ddn_fragment", qty: 1 });
addToPanel(panel2, { itemKey: "ddn_fragment", qty: 4 });
assert.strictEqual(panel2.items.length, 1, "no-note items still merge with each other");
assert.strictEqual(panel2.items[0].qty, 5);

// "unique" type: typed on separate lines -> separate rows, never merged,
// even with identical note/detail (each is a distinct physical drop).
const panel3 = { items: [] };
addToPanel(panel3, { itemKey: "ddn_smelted_rune", qty: 1 });
addToPanel(panel3, { itemKey: "ddn_smelted_rune", qty: 1 });
assert.strictEqual(panel3.items.length, 2, "unique items must not merge across lines");
assert.strictEqual(panel3.items[0].qty, 1);
assert.strictEqual(panel3.items[1].qty, 1);

// "unique" type: qty>1 on ONE line also splits into separate qty-1 rows.
const panel4 = { items: [] };
addToPanel(panel4, { itemKey: "ddn_smelted_rune", qty: 3 });
assert.strictEqual(panel4.items.length, 3, "unique x3 on one line splits into 3 rows");
assert.ok(panel4.items.every((i) => i.qty === 1));

console.log("✅ addToPanel merge rules (quantity stacks, unique never merges) OK");
