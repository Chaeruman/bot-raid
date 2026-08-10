// Run: node app/_lootComponentsTest.js — checks button visibility rules:
// no seller = only Set Seller + Add Member; remove-* buttons need data first.
const assert = require("assert");
const { buildLootComponents } = require("./builders/lootPanel");

function labels(rows) {
  return rows.flatMap((r) => r.components.map((c) => c.data.label));
}

const base = { lootMsgId: "p1", sellerId: null, sellerIgn: null, items: [], goldEntries: [], members: [], closed: false };

// No seller, no members: only Set Seller (disabled) + Add Member. Refresh is
// always there — it redraws from stored state and needs nothing to exist.
let l = labels(buildLootComponents({ ...base }));
assert.deepStrictEqual(l, ["👤 Seller", "👥 Add Member", "🔄 Refresh"]);

// No seller, has members: same buttons (Seller no longer disabled, but still just these two).
l = labels(buildLootComponents({ ...base, members: ["u1"] }));
assert.deepStrictEqual(l, ["👤 Seller", "👥 Add Member", "🔄 Refresh"]);

// Seller set, no items/gold/members: full row1/row2 minus remove-*, row3 no
// Remove Member, Close Panel present but Mark Paid hidden (nothing to pay yet).
l = labels(buildLootComponents({ ...base, sellerId: "s1" }));
assert.ok(l.includes("✍️ Type Items") && l.includes("📋 Browse Item"));
assert.ok(!l.includes("🗑️ Remove Item"));
assert.ok(!l.includes("🗑️ Remove Gold"));
assert.ok(!l.includes("➖ Remove Member"));
assert.ok(l.includes("💰 Add Gold") && l.includes("🔒 Close Panel"));
assert.ok(!l.includes("✅ Mark Paid"));

// Seller set + items/gold/members present, but item unpriced: Mark Paid
// still hidden — pricing isn't finalized yet, remove-* buttons appear.
l = labels(
  buildLootComponents({
    ...base,
    sellerId: "s1",
    items: [{ itemKey: "gdn_fragment", qty: 1, price: null }],
    goldEntries: [{ amount: 100, splitCount: 8 }],
    members: ["u1"],
  }),
);
assert.ok(l.includes("🗑️ Remove Item"));
assert.ok(l.includes("🗑️ Remove Gold"));
assert.ok(l.includes("➖ Remove Member"));
assert.ok(!l.includes("✅ Mark Paid"));

// Seller set + gold entry only (zero items) — the pure-gacha/gold-raid case:
// Mark Paid appears since there's something to pay out and nothing left unpriced.
l = labels(buildLootComponents({ ...base, sellerId: "s1", goldEntries: [{ amount: 100, splitCount: 8 }], members: ["u1"] }));
assert.ok(l.includes("✅ Mark Paid"));

// Item priced (fully sold) + members: Mark Paid appears.
l = labels(
  buildLootComponents({
    ...base,
    sellerId: "s1",
    items: [{ itemKey: "gdn_fragment", qty: 1, price: 800 }],
    members: ["u1"],
  }),
);
assert.ok(l.includes("✅ Mark Paid"));

console.log("✅ loot panel button visibility rules OK");

// Refresh survives every shape of panel: its only job is to redraw what is
// already stored, so there is no state in which it should be missing.
for (const p of [
  { ...base },
  { ...base, sellerId: "s1" },
  { ...base, sellerId: "s1", items: [{ itemKey: "gdn_fragment", qty: 1, price: 800 }], members: ["u1"] },
]) {
  assert.ok(labels(buildLootComponents(p)).includes("🔄 Refresh"), "refresh is always offered");
}
console.log("✅ refresh button present on every panel shape");

// The Add Gold modal. It reaches the user by three different routes (÷8 direct,
// the marathon type picker, the ÷7 exclude picker) and used to be copied into
// all three — so a field added to one of them would silently not exist on the
// other two. One builder now, and this pins its shape.
const { buildGoldModal } = require("./builders/goldModal");

const modalFields = (m) => m.toJSON().components.map((c) => c.component.custom_id);
const p = { lootMsgId: "p1" };

assert.deepStrictEqual(modalFields(buildGoldModal(p, 8)), ["amount", "bonus_source"]);
assert.deepStrictEqual(modalFields(buildGoldModal(p, 7, "u1")), ["amount", "bonus_source"]);

// The customId carries everything the handler needs, since a modal cannot see
// what opened it.
assert.strictEqual(buildGoldModal(p, 8).toJSON().custom_id, "loot-modal:gold:p1:8:none");
assert.strictEqual(buildGoldModal(p, 7, "u1").toJSON().custom_id, "loot-modal:gold:p1:7:u1");

// Optional, so "not the bonus pot" — the common case — costs no interaction. A
// required select here would make every gold entry answer a question about a
// feature most runs never use.
const src = buildGoldModal(p, 8).toJSON().components[1].component;
assert.strictEqual(src.required, false, "the bonus-source select is optional");
assert.strictEqual(src.options.length, 1, "one option: picking it means yes, blank means no");
console.log("✅ Add Gold modal has the bonus-source option on every route");
