// Run: node app/_lootComponentsTest.js — checks button visibility rules:
// no seller = only Set Seller + Add Member; remove-* buttons need data first.
const assert = require("assert");
const { buildLootComponents } = require("./builders/lootPanel");

function labels(rows) {
  return rows.flatMap((r) => r.components.map((c) => c.data.label));
}

const base = { lootMsgId: "p1", sellerId: null, sellerIgn: null, items: [], goldEntries: [], members: [], closed: false };

// No seller, no members: only Set Seller (disabled) + Add Member.
let l = labels(buildLootComponents({ ...base }));
assert.deepStrictEqual(l, ["👤 Seller", "👥 Add Member"]);

// No seller, has members: same buttons (Seller no longer disabled, but still just these two).
l = labels(buildLootComponents({ ...base, members: ["u1"] }));
assert.deepStrictEqual(l, ["👤 Seller", "👥 Add Member"]);

// Seller set, no items/gold/members: full row1/row2 minus remove-*, row3 no Remove Member, row4 present.
l = labels(buildLootComponents({ ...base, sellerId: "s1" }));
assert.ok(l.includes("✍️ Type Items") && l.includes("📋 Browse Item"));
assert.ok(!l.includes("🗑️ Remove Item"));
assert.ok(!l.includes("🗑️ Remove Gold"));
assert.ok(!l.includes("➖ Remove Member"));
assert.ok(l.includes("💰 Add Gold") && l.includes("✅ Mark Paid") && l.includes("🔒 Close Panel"));

// Seller set + items/gold/members present: remove-* buttons appear.
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

console.log("✅ loot panel button visibility rules OK");
