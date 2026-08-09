// Market board self-test — run:  node app/_marketTest.js
// No Discord/network needed; exercises collectRows + buildMarketEmbeds only.
const assert = require("assert");
const { collectRows, buildMarketEmbeds, itemLabel } = require("./market");

const NOW = Date.UTC(2026, 7, 9, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
// Panel ids ARE the clock — the board reads age straight off the snowflake.
const idAgo = (ms) => String(BigInt(NOW - ms - 1420070400000) << 22n);

const panel = (over) => ({
  lootMsgId: idAgo(2 * HOUR),
  sellerIgn: "Rubiq",
  closed: false,
  items: [],
  ...over,
});

const rowsOf = (items, over) => collectRows({ a: panel({ items, ...over }) }, NOW);

// --- Text format -----------------------------------------------------------
// "GDN Legend Accessory (Necklace@INT VIT)" → "GDN L Necklace · INT VIT".
assert.strictEqual(itemLabel("gdn_l_accessory", "Necklace@INT VIT"), "GDN L Necklace · INT VIT");
assert.strictEqual(itemLabel("ddn_u_accessory", "Ring@Attack"), "DDN U Ring · Attack");
assert.strictEqual(itemLabel("ddn_armor", "Warrior@Head"), "DDN Armor Warrior · Head");
// Fragments and other quantity-type items carry no detail at all.
assert.strictEqual(itemLabel("ddn_armor", null), "DDN Armor");

// --- Accessory: Legend vs Unique, never mixed with equipment ---------------
{
  const rows = rowsOf([
    { itemKey: "gdn_l_accessory", detail: "Ring@Attack", qty: 1 },
    { itemKey: "gdn_u_accessory", detail: "Ring@Attack", qty: 1 },
    { itemKey: "ddn_armor", detail: "Warrior@Head", qty: 1 },
  ]);
  const at = (name) => rows.find((r) => r.name === name);
  assert.deepStrictEqual(at("GDN L Ring · Attack"), { ...at("GDN L Ring · Attack"), category: "acc", block: "L" });
  assert.deepStrictEqual(at("GDN U Ring · Attack"), { ...at("GDN U Ring · Attack"), category: "acc", block: "U" });
  assert.strictEqual(at("DDN Armor Warrior · Head").category, "equip");
}

// --- Equipment: DDN → level 60, GDN/SDN → level 50 -------------------------
{
  const { NAMED_EQUIPMENT } = require("./items");
  const ddn = NAMED_EQUIPMENT.find((e) => e.kind && e.dungeon === "ddn");
  const gdn = NAMED_EQUIPMENT.find((e) => e.kind && e.dungeon === "gdn");
  const rows = rowsOf([
    { itemKey: "ddn_weapon", detail: "Kali@Main", qty: 1 },
    { itemKey: "gdn_armor", detail: "Cleric@Shoes", qty: 1 },
    { itemKey: ddn.key, qty: 1 }, // named equipment takes its level from its own dungeon field
    { itemKey: gdn.key, qty: 1 },
  ]);
  const block = Object.fromEntries(rows.map((r) => [r.name, r.block]));
  assert.strictEqual(block["DDN Weapon Kali · Main"], 60);
  assert.strictEqual(block["GDN Armor Cleric · Shoes"], 50);
  assert.strictEqual(block[ddn.name], 60);
  assert.strictEqual(block[gdn.name], 50);
  assert.ok(rows.every((r) => r.category === "equip"));
}

// --- What stays off the board ----------------------------------------------
{
  const rows = rowsOf([
    { itemKey: "storm_l", qty: 1 },
    { itemKey: "hot_sand_u", qty: 1 },
    { itemKey: "thorns_l", qty: 1 },
    { itemKey: "forest_u_junk", qty: 1 },
    { itemKey: "gdn_fragment", qty: 5 },
    { itemKey: "ddn_smelted_rune", qty: 1 },
    { itemKey: "ddn_research_book", qty: 1 },
  ]);
  assert.deepStrictEqual(rows, []);
}

// Priced, notForSale and closed-panel items all drop off.
{
  const rows = collectRows({
    a: panel({ items: [{ itemKey: "ddn_l_accessory", detail: "Ring@Attack", qty: 1, price: 5000 }] }),
    b: panel({ items: [{ itemKey: "gdn_l_accessory", detail: "Ring@Magic", qty: 1, notForSale: true }] }),
    c: panel({ closed: true, items: [{ itemKey: "sdn_l_accessory", detail: "Ring@Hybrid", qty: 1 }] }),
  }, NOW);
  assert.deepStrictEqual(rows, []);
}

// Same item on two panels = ONE row, both sellers, freshest age wins.
{
  const item = { itemKey: "gdn_u_accessory", detail: "Necklace@INT VIT", qty: 1 };
  const rows = collectRows({
    a: panel({ lootMsgId: idAgo(50 * HOUR), sellerIgn: "Rubiq", items: [item] }),
    b: panel({ lootMsgId: idAgo(1 * HOUR), sellerIgn: "Azka", items: [item] }),
  }, NOW);
  assert.strictEqual(rows.length, 1);
  assert.deepStrictEqual(rows[0].sellers, ["Rubiq", "Azka"]);
  assert.strictEqual(rows[0].age, 1 * HOUR);
}

// Panels older than the 14-day cutoff are ghosts, not stock.
{
  const item = { itemKey: "ddn_weapon", detail: "Kali@Main", qty: 1 };
  assert.strictEqual(rowsOf([item], { lootMsgId: idAgo(13 * 24 * HOUR) }).length, 1);
  assert.strictEqual(rowsOf([item], { lootMsgId: idAgo(15 * 24 * HOUR) }).length, 0);
}

// --- Embeds ----------------------------------------------------------------
// Empty board is still one embed, not zero — the message gets edited, never deleted.
{
  const embeds = buildMarketEmbeds({}, NOW);
  assert.strictEqual(embeds.length, 1);
  assert.match(embeds[0].data.description, /Belum ada/);
}

// The real board, from live data: two embeds, blocks in order, empty block hidden.
{
  const p = (ign, ageH, items) => panel({ lootMsgId: idAgo(ageH * HOUR), sellerIgn: ign, items });
  const embeds = buildMarketEmbeds({
    a: p("hama", 8, [
      { itemKey: "gdn_l_accessory", detail: "Necklace@INT VIT", qty: 1 },
      { itemKey: "gdn_l_accessory", detail: "Ring@Attack", qty: 1 },
      { itemKey: "gdn_armor", detail: "Warrior@Head", qty: 1 },
    ]),
    b: p("Chelssea", 11, [{ itemKey: "gdn_l_accessory", detail: "Necklace@AGI INT", qty: 1 }]),
    c: p("Fordatez", 5 * 24, [{ itemKey: "ddn_l_accessory", detail: "Necklace@INT VIT", qty: 1 }]),
    d: p("caelyn", 3 * 24, [{ itemKey: "ddn_weapon", detail: "Kali@Main", qty: 1 }]),
  }, NOW);

  assert.strictEqual(embeds.length, 2);
  assert.strictEqual(embeds[0].data.title, "ON SALE: Accessory");
  assert.strictEqual(embeds[1].data.title, "ON SALE: Equipment");
  for (const e of embeds)
    assert.ok(!/\p{Extended_Pictographic}/u.test(e.data.title + e.data.description), "emoji bocor");
  assert.deepStrictEqual(embeds[0].data.description.split("\n"), [
    "**Legend**", // no Unique block at all — nobody is selling one
    "GDN L Necklace · INT VIT (hama | 8 jam)",
    "GDN L Ring · Attack (hama | 8 jam)",
    "GDN L Necklace · AGI INT (Chelssea | 11 jam)",
    "DDN L Necklace · INT VIT (Fordatez | 5 hari)",
  ]);
  assert.deepStrictEqual(embeds[1].data.description.split("\n"), [
    "**Level 60**",
    "DDN Weapon Kali · Main (caelyn | 3 hari)",
    "**Level 50**",
    "GDN Armor Warrior · Head (hama | 8 jam)",
  ]);
  for (const e of embeds)
    assert.ok(!/[—–-]/.test(e.data.description), `dash bocor: ${e.data.description}`);
}

// Both embeds still fit Discord's 6000-per-message cap under absurd load.
{
  const items = [];
  for (let i = 0; i < 400; i++) items.push({ itemKey: "ddn_l_accessory", detail: `Ring@Attack ${i}`, qty: 1 });
  for (let i = 0; i < 400; i++) items.push({ itemKey: "gdn_armor", detail: `Warrior@Head ${i}`, qty: 1 });
  const embeds = buildMarketEmbeds({ a: panel({ items }) }, NOW);
  assert.strictEqual(embeds.length, 2);
  assert.ok(embeds.every((e) => /baris lagi/.test(e.data.description)), "overflow note missing");
  const total = embeds.reduce((n, e) => n + e.data.description.length + e.data.title.length, 0);
  assert.ok(total < 6000, `message budget blown: ${total}`);
}

console.log("✅ market: semua check lolos");
