// The market board — one message in #market, re-edited whenever a loot panel
// changes. Answers "punya DDN ring nggak?" without opening eight salary threads.
//
// Nothing new is stored. An item with no price on an open panel IS an item still
// on the market: pricing it drops it from the board, and closeLoot deleting the
// panel takes the rest with it. No lifecycle to manage, nothing for a seller to
// cross off by hand.
const { EmbedBuilder } = require("discord.js");
const config = require("./config");
const { activeLootPanels, marketBoard, saveState } = require("./state");
const { CATALOG, NAMED_EQUIPMENT, isAccessory, isEquipment } = require("./items");

const HOUR_MS = 60 * 60 * 1000;
const MAX_AGE_MS = 14 * 24 * HOUR_MS; // a panel left open longer than this is a ghost, not a shop
const DEBOUNCE_MS = 5000;
// Two embeds have to share Discord's 6000-per-message budget. A fixed slice
// each rather than a running total: it cannot overshoot, and the board has
// never come near it.
const PER_EMBED = 2800;

// Only what a buyer actually shops for. Rune, fragment and research book are
// bulk goods nobody browses a board for — and they are most of the lines on a
// panel, so leaving them out is what keeps this readable.
const NAMED_EQUIPMENT_KEYS = new Set(NAMED_EQUIPMENT.filter((e) => e.kind).map((e) => e.key));
const onBoard = (key) => isAccessory(key) || isEquipment(key) || NAMED_EQUIPMENT_KEYS.has(key);

// Discord ids carry their own creation time, so "how old is this" needs no
// field on the panel and no migration for the panels already open.
const snowflakeMs = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);

function ageLabel(ms) {
  const h = Math.floor(ms / HOUR_MS);
  if (h < 1) return "baru";
  if (h < 24) return `${h} jam`;
  return `${Math.floor(h / 24)} hari`;
}

// One row per distinct item, not per panel — three people holding the same ring
// is one line with three names, which is what actually keeps the board short.
//
// Age is the FRESHEST panel holding it: a row that says "2 hari" when someone
// listed one an hour ago reads as stale stock.
function collectRows(panels, now = Date.now()) {
  const byItem = new Map();

  for (const panel of Object.values(panels)) {
    if (panel.closed || !panel.lootMsgId) continue;
    const age = now - snowflakeMs(panel.lootMsgId);
    if (age > MAX_AGE_MS) continue;

    for (const item of panel.items || []) {
      if (item.price != null || item.notForSale) continue;
      if (!onBoard(item.itemKey)) continue;
      const def = CATALOG[item.itemKey];
      if (!def) continue;

      const category = isAccessory(item.itemKey) ? "Accessory" : "Equipment";
      // ponytail: no qty. Everything on this board is a unique drop, so it is
      // 1x — bring it back if stackables ever earn a place here.
      const name = `${def.name}${item.detail ? ` (${item.detail})` : ""}`;
      const key = `${category}|${name}`;

      if (!byItem.has(key)) byItem.set(key, { category, name, sellers: [], age });
      const row = byItem.get(key);
      if (panel.sellerIgn && !row.sellers.includes(panel.sellerIgn)) row.sellers.push(panel.sellerIgn);
      row.age = Math.min(row.age, age);
    }
  }

  return [...byItem.values()].sort((a, b) => a.age - b.age || a.name.localeCompare(b.name));
}

const rowText = (r) => `${r.name} — ${r.sellers.join(", ") || "—"} · ${ageLabel(r.age)}`;

// Dropping the tail and saying so, rather than letting Discord reject the whole
// message and the board simply vanish.
function fit(lines) {
  const out = [];
  let len = 0;
  for (const line of lines) {
    if (len + line.length + 1 > PER_EMBED) {
      out.push(`_…${lines.length - out.length} baris lagi_`);
      break;
    }
    out.push(line);
    len += line.length + 1;
  }
  return out.join("\n");
}

const CATS = [
  ["Accessory", "💍"],
  ["Equipment", "⚔️"],
];

function buildMarketEmbeds(panels, now = Date.now()) {
  const rows = collectRows(panels, now);

  // An empty board is still the same message, edited. Deleting and reposting it
  // would move it off the top of the channel every time the last item sells.
  if (!rows.length)
    return [
      new EmbedBuilder()
        .setTitle("🏪 ON SALE")
        .setColor(0x2ecc71)
        .setDescription("Belum ada item yang sedang dijual."),
    ];

  const embeds = CATS.flatMap(([cat, emoji]) => {
    const mine = rows.filter((r) => r.category === cat);
    if (!mine.length) return [];
    return new EmbedBuilder()
      .setTitle(`🏪 ON SALE — ${emoji} ${cat}`)
      .setColor(0x2ecc71)
      .setDescription(fit(mine.map(rowText)));
  });

  embeds[embeds.length - 1].setFooter({
    text: `${rows.length} item · diperbarui ${new Date(now).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })} WIB`,
  });

  return embeds;
}

async function syncMarket(client) {
  if (!config.marketChannelId) return;
  const channel = await client.channels.fetch(config.marketChannelId).catch(() => null);
  if (!channel) return;

  const embeds = buildMarketEmbeds(activeLootPanels);

  if (marketBoard.messageId) {
    const msg = await channel.messages.fetch(marketBoard.messageId).catch(() => null);
    if (msg) return msg.edit({ embeds });
    marketBoard.messageId = null; // deleted by hand — repost below
  }

  const msg = await channel.send({ embeds });
  marketBoard.messageId = msg.id;
  saveState();
}

// Called from refreshLootPanel, i.e. after every single loot mutation. The
// debounce is what makes that affordable: one Type Items batch of six items is
// one edit, not six.
//
// It also fixes Close Panel for free — closeLoot refreshes the panel BEFORE
// deleting it from activeLootPanels, so an immediate sync would still see the
// closed panel's items. Five seconds later it is gone.
let timer = null;
function queueMarketSync(client) {
  if (!config.marketChannelId || timer) return;
  timer = setTimeout(() => {
    timer = null;
    syncMarket(client).catch((err) => console.error("❌ syncMarket:", err.message));
  }, DEBOUNCE_MS);
}

function startMarket(client) {
  if (!config.marketChannelId) {
    console.log("🏪 Market board off (MARKET_CHANNEL_ID belum diset)");
    return;
  }
  const tick = () => syncMarket(client).catch((err) => console.error("❌ syncMarket:", err.message));
  tick(); // boot: redraw whatever changed while we were down, and age the rows
  // The board is event-driven; this is only the safety net for an edit that
  // failed and for rows crossing the 14-day cutoff with nobody touching a panel.
  setInterval(tick, HOUR_MS);
  console.log("🏪 Market board aktif — update tiap ada perubahan loot panel");
}

module.exports = { collectRows, buildMarketEmbeds, syncMarket, queueMarketSync, startMarket };
