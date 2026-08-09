// Market board self-test — run:  node app/_marketTest.js
// No Discord/network needed; exercises collectRows + buildMarketEmbeds only.
const assert = require("assert");
const { collectRows, buildMarketEmbeds } = require("./market");

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

const names = (rows) => rows.map((r) => r.name);

// Only accessory + equipment; rune/fragment/research stay off the board.
{
  const rows = collectRows({
    a: panel({
      items: [
        { itemKey: "ddn_l_accessory", detail: "Ring (Attack)", qty: 1 },
        { itemKey: "ddn_armor", detail: "Warrior · Head", qty: 1 },
        { itemKey: "thorns_l", qty: 1 },
        { itemKey: "gdn_fragment", qty: 5 },
        { itemKey: "ddn_research_book", qty: 1 },
      ],
    }),
  }, NOW);
  // Flat list, sorted by age then name — the split into categories happens in
  // buildMarketEmbeds, not here.
  assert.deepStrictEqual(names(rows), ["DDN Armor (Warrior · Head)", "DDN Legend Accessory (Ring (Attack))"]);
  assert.deepStrictEqual(rows.map((r) => r.category), ["Equipment", "Accessory"]);
}

// Priced, notForSale and closed-panel items all drop off.
{
  const rows = collectRows({
    a: panel({ items: [{ itemKey: "ddn_l_accessory", detail: "Ring (Attack)", qty: 1, price: 5000 }] }),
    b: panel({ items: [{ itemKey: "gdn_l_accessory", detail: "Ring (Magic)", qty: 1, notForSale: true }] }),
    c: panel({ closed: true, items: [{ itemKey: "sdn_l_accessory", detail: "Ring (Hybrid)", qty: 1 }] }),
  }, NOW);
  assert.deepStrictEqual(rows, []);
}

// Same item on two panels = ONE row, both sellers, freshest age wins.
{
  const item = { itemKey: "gdn_u_accessory", detail: "Necklace (INT VIT)", qty: 1 };
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
  const item = { itemKey: "ddn_weapon", detail: "Kali · Main", qty: 1 };
  assert.strictEqual(collectRows({ a: panel({ lootMsgId: idAgo(13 * 24 * HOUR), items: [item] }) }, NOW).length, 1);
  assert.strictEqual(collectRows({ a: panel({ lootMsgId: idAgo(15 * 24 * HOUR), items: [item] }) }, NOW).length, 0);
}

// Named equipment is on the board; named fragments (no `kind`) are not.
{
  const { NAMED_EQUIPMENT } = require("./items");
  const chakram = NAMED_EQUIPMENT.find((e) => e.kind && /chakram/i.test(e.name));
  const spitflower = NAMED_EQUIPMENT.find((e) => e.name === "Spitflower Ignis");
  const rows = collectRows({
    a: panel({ items: [{ itemKey: chakram.key, qty: 1 }, { itemKey: spitflower.key, qty: 1 }] }),
  }, NOW);
  assert.deepStrictEqual(names(rows), [chakram.name]);
}

// Empty board is still one embed, not zero — the message gets edited, never deleted.
{
  const embeds = buildMarketEmbeds({}, NOW);
  assert.strictEqual(embeds.length, 1);
  assert.match(embeds[0].data.description, /Belum ada/);
}

// One embed per non-empty category, and both fit Discord's 6000/message cap.
{
  const items = [];
  for (let i = 0; i < 400; i++) items.push({ itemKey: "ddn_l_accessory", detail: `Ring (Attack ${i})`, qty: 1 });
  for (let i = 0; i < 400; i++) items.push({ itemKey: "ddn_armor", detail: `Warrior · Head ${i}`, qty: 1 });
  const embeds = buildMarketEmbeds({ a: panel({ items }) }, NOW);
  assert.strictEqual(embeds.length, 2);
  assert.ok(embeds.every((e) => /baris lagi/.test(e.data.description)), "overflow note missing");
  const total = embeds.reduce((n, e) => n + e.data.description.length + e.data.title.length, 0);
  assert.ok(total < 6000, `message budget blown: ${total}`);
}

// A category with nothing in it does not get an empty embed.
{
  const embeds = buildMarketEmbeds(
    { a: panel({ items: [{ itemKey: "ddn_l_accessory", detail: "Ring (Attack)", qty: 1 }] }) },
    NOW,
  );
  assert.strictEqual(embeds.length, 1);
  assert.match(embeds[0].data.title, /Accessory/);
  assert.match(embeds[0].data.description, /DDN Legend Accessory \(Ring \(Attack\)\) — Rubiq · 2 jam/);
}

console.log("✅ market: semua check lolos");
