// Run: node app/_gachaTest.js — checks the "gacha" (notForSale) item
// mechanism: parsed from Type Items, excluded from salary math, panel still
// counts as "ready" from raw gold alone even with zero sellable items.
const assert = require("assert");
const { parseItemLines } = require("./utils/parseItems");
const { memberSalary, allItemsSold } = require("./builders/lootPanel");

// 1) "gacha" keyword is stripped before matching and flags the item.
{
  const { added } = parseItemLines("gdn fragment x2 gacha #buat siapa yang menang");
  assert.strictEqual(added.length, 1);
  assert.strictEqual(added[0].itemKey, "gdn_fragment");
  assert.strictEqual(added[0].notForSale, true);
  assert.strictEqual(added[0].note, "buat siapa yang menang");
}

// 2) Non-gacha items are unaffected (flag is false, not missing).
{
  const { added } = parseItemLines("gdn fragment x2");
  assert.strictEqual(added[0].notForSale, false);
}

// 3) "gacha" also works on named-equipment / structural lines without
// breaking their own matching (keyword stripped before dispatch).
{
  const { added } = parseItemLines("ddn smelted rune gacha");
  assert.strictEqual(added.length, 1);
  assert.strictEqual(added[0].itemKey, "ddn_smelted_rune");
  assert.strictEqual(added[0].notForSale, true);
}

// 4) A gacha item contributes nothing to salary math even if it somehow has
// a price — only raw gold counts.
{
  const panel = {
    stampRate: 5,
    items: [{ itemKey: "gdn_fragment", qty: 1, price: 99999, notForSale: true }],
    goldEntries: [{ amount: 800, splitCount: 8 }],
  };
  const salary = memberSalary(panel, null);
  assert.strictEqual(salary, Math.floor(Math.floor(800 / 8) * (1 - 0.003)));
}

// 5) allItemsSold: a panel with ONLY a gacha item + raw gold (no sellable
// items priced) counts as ready — this is the actual bug being fixed
// (thread title never showed 💵 for pure-gacha-plus-gold raids before).
{
  const panel = {
    items: [{ itemKey: "gdn_fragment", qty: 1, price: null, notForSale: true }],
    goldEntries: [{ amount: 800, splitCount: 8 }],
  };
  assert.strictEqual(allItemsSold(panel), true);
}

// 5b) Order doesn't matter and no item needs to exist at all — plain gold
// raid entered with ZERO items typed (not even a gacha one) is also ready.
{
  const panel = { items: [], goldEntries: [{ amount: 800, splitCount: 8 }] };
  assert.strictEqual(allItemsSold(panel), true);
}

// 6) But a gacha item alone with NO gold at all is not payment-ready —
// nothing to actually distribute.
{
  const panel = {
    items: [{ itemKey: "gdn_fragment", qty: 1, price: null, notForSale: true }],
    goldEntries: [],
  };
  assert.strictEqual(allItemsSold(panel), false);
}

// 7) A mix of one gacha item and one unpriced sellable item is NOT ready
// (the sellable one still needs a price) — gacha doesn't mask real gaps.
{
  const panel = {
    items: [
      { itemKey: "gdn_fragment", qty: 1, price: null, notForSale: true },
      { itemKey: "gdn_fragment", qty: 1, price: null, notForSale: false },
    ],
    goldEntries: [],
  };
  assert.strictEqual(allItemsSold(panel), false);
}

// 8) An item priced below its own stamp fee can't push salary negative —
// clamped at 0, since nobody owes the seller money.
{
  const panel = {
    stampRate: 5,
    items: [{ itemKey: "ddn_l_accessory", qty: 1, price: 1, notForSale: false }], // 37 stamps * 5g = 185g fee, priced at 1g
    goldEntries: [],
  };
  assert.strictEqual(memberSalary(panel, null), 0);
}

// 9) Retroactive "gacha" via Price All — same detection logic as
// setPrices.js's handler: an item typed WITHOUT gacha at add-time can still
// be marked not-for-sale later by typing "gacha" in its Price All line.
{
  const item = { itemKey: "gdn_fragment", qty: 1, price: null, notForSale: false, note: null };
  const line = "1. GDN Fragment x1 gacha #dibagikan =";
  const eqIdx = line.lastIndexOf("=");
  let left = line.slice(0, eqIdx);
  if (/\bgacha\b/i.test(left)) {
    left = left.replace(/\bgacha\b/i, " ").replace(/\s+/g, " ");
    item.notForSale = true;
  }
  const hashIdx = left.indexOf("#");
  if (hashIdx >= 0) item.note = left.slice(hashIdx + 1).trim() || null;
  assert.strictEqual(item.notForSale, true);
  assert.strictEqual(item.note, "dibagikan");
}

console.log("✅ gacha (notForSale) item mechanism OK");
