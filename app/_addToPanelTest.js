// Run: node app/_addToPanelTest.js — checks that items with different notes
// stay on separate lines instead of merging (and losing the earlier note).
const assert = require("assert");
const { addToPanel } = require("./handlers/modals/addItems");

const panel = { items: [] };
addToPanel(panel, { itemKey: "gdn_armor", qty: 1, note: "for budi" });
addToPanel(panel, { itemKey: "gdn_armor", qty: 1, note: "for sari" });
assert.strictEqual(panel.items.length, 2, "different notes must not merge");
assert.strictEqual(panel.items[0].note, "for budi");
assert.strictEqual(panel.items[1].note, "for sari");

// Same item, same note (including both null) -> merges and sums qty.
addToPanel(panel, { itemKey: "gdn_armor", qty: 2, note: "for budi" });
assert.strictEqual(panel.items.length, 2, "same note must still merge");
assert.strictEqual(panel.items[0].qty, 3);

const panel2 = { items: [] };
addToPanel(panel2, { itemKey: "gdn_fragment", qty: 1 });
addToPanel(panel2, { itemKey: "gdn_fragment", qty: 4 });
assert.strictEqual(panel2.items.length, 1, "no-note items still merge with each other");
assert.strictEqual(panel2.items[0].qty, 5);

console.log("✅ addToPanel note-aware merge OK");
