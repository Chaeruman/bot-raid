const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { CATALOG } = require("../items");

const STAMP_RATE_GOLD = 5; // gold per stamp (market fee) — panels store their own rate at creation, see panel.stampRate
const MAIL_TAX_RATE = 0.003; // 0.3% mail tax, deducted from the final salary

// Exact salary for one member: ÷8 pool share + ÷7 HC gold, minus any ÷7 entry
// they're excluded from, minus 0.3% mail tax. Pass uid=null for the headline
// (non-excluded) figure.
function memberSalary(panel, uid) {
  // notForSale items (gacha/duck-race giveaways) exist in the list for
  // record-keeping but were never actually sold — no stamp fee, no gold.
  const soldItems = panel.items.filter((i) => i.price != null && !i.notForSale);
  const soldStamps = soldItems.reduce((sum, i) => sum + CATALOG[i.itemKey].stampsPerUnit * i.qty, 0);
  const stampFee = soldStamps * (panel.stampRate ?? 4); // ponytail: panels made before the rate bump lack this field, default to the old 4g/stamp so they don't retroactively change
  const totalItemGold = soldItems.reduce(
    (sum, i) => sum + (CATALOG[i.itemKey].type === "quantity" ? i.price : i.price * i.qty),
    0,
  );
  const itemNet = totalItemGold - stampFee;
  const gold8Total = panel.goldEntries.filter((g) => g.splitCount === 8).reduce((sum, g) => sum + g.amount, 0);
  // `!uid` first, and it is not a tidy-up. The headline figure is computed with
  // uid = null, and an entry that excludes nobody is STORED as
  // excludedUserId: null — so `g.excludedUserId !== uid` read null !== null and
  // silently dropped every ÷7 gold drop that had no exclusion, which is most of
  // them. The panel listed the gold, the formula printed it, and nobody was paid
  // it. Never compare an id against a sentinel that is also a real value.
  const gold7PerPerson = panel.goldEntries
    .filter((g) => g.splitCount === 7 && (!uid || g.excludedUserId !== uid))
    .reduce((sum, g) => sum + Math.floor(g.amount / 7), 0);
  // Manual top-up for ONE member, for when the game's own 36g HC/CL mail never
  // arrived and the missing gold has to ride along with their salary instead.
  // It is per-member by definition, so the headline figure (uid = null) never
  // carries it — and it sits inside `gross` so the same 0.3% mail tax applies,
  // because it goes out in the same mail as everything else here.
  const bonus = uid ? panel.bonuses?.[uid] || 0 : 0;
  const gross = Math.floor((itemNet + gold8Total) / 8) + gold7PerPerson + bonus;
  // An item priced below its own stamp fee can drag this negative — nobody
  // owes the seller money, so floor the payout at 0.
  return Math.max(0, Math.floor(gross * (1 - MAIL_TAX_RATE)));
}

// Headline (non-excluded) salary — used for thread title.
const salaryPerPerson = (panel) => memberSalary(panel, null);

function allItemsSold(panel) {
  // notForSale items don't need a price. A panel is "ready" once every
  // sellable item is priced AND there's actually something to pay out
  // (a sellable item or a raw gold entry) — a pure-gacha panel with only
  // gold drops counts as ready even though panel.items has zero sellable rows.
  const sellable = panel.items.filter((i) => !i.notForSale);
  // A bonus counts as a payout on its own: a run that dropped nothing but left
  // someone short a mail still has real gold to send, and without this the
  // seller would have no Mark Paid button to send it with.
  const hasPayout =
    sellable.length > 0 || panel.goldEntries.length > 0 || Object.keys(panel.bonuses || {}).length > 0;
  return hasPayout && sellable.every((i) => i.price != null);
}

// Rename the dedicated loot thread once all items are priced (💵) or all paid (✅).
// No-op for /loot panels (no own thread) and when the name is unchanged.
async function updateThreadTitle(thread, panel) {
  if (!panel.ownThread) return;
  if (!panel.closed && !allItemsSold(panel)) return;

  const emoji = panel.closed ? "✅" : "💵";
  // Derive the base from the CURRENT thread name (minus any prefix we added before),
  // so manual renames are respected and the prefix never stacks.
  const base = thread.name.replace(/^(?:💵|✅)\s*[\d,]+g\s*—\s*/u, "");
  const name = `${emoji} ${salaryPerPerson(panel).toLocaleString()}g — ${base}`.slice(0, 100);

  if (thread.name !== name) {
    try {
      await thread.setName(name);
    } catch (err) {
      console.error("❌ thread title update failed:", err.message);
    }
  }
}

function itemsText(panel) {
  if (panel.items.length === 0) return "_None_";
  return panel.items
    .map((item) => {
      const def = CATALOG[item.itemKey];
      const detailStr = item.detail ? ` (${item.detail})` : "";
      const noteStr = item.note ? ` _(${item.note})_` : "";
      if (item.notForSale) {
        return `• ${def.name}${detailStr} — ${item.qty}x — 🎁 _gacha, tidak dijual_${noteStr}`;
      }
      const stamps = def.stampsPerUnit * item.qty;
      const priceStr = item.price != null
        ? ` — ${item.price.toLocaleString()} gold${def.type === "quantity" ? " total" : ""}`
        : "";
      return `• ${def.name}${detailStr} — ${item.qty}x — ${stamps} stamps${priceStr}${noteStr}`;
    })
    .join("\n")
    .slice(0, 1024);
}

function goldText(panel) {
  if (panel.goldEntries.length === 0) return null;
  return panel.goldEntries
    .map((g) => {
      const perPerson = Math.floor(g.amount / g.splitCount);
      const excl = g.excludedUserId ? `, <@${g.excludedUserId}> tidak dapat` : "";
      return `• ${g.amount.toLocaleString()} (÷${g.splitCount}${excl} = ${perPerson.toLocaleString()}/person)`;
    })
    .join("\n")
    .slice(0, 1024);
}

function summaryText(panel) {
  const bonuses = panel.bonuses || {};
  if (panel.items.length === 0 && panel.goldEntries.length === 0 && Object.keys(bonuses).length === 0) return null;

  const lines = [];
  const sellableItems = panel.items.filter((i) => !i.notForSale);
  const soldItems = sellableItems.filter((i) => i.price != null);
  const soldStamps = soldItems.reduce((sum, i) => sum + CATALOG[i.itemKey].stampsPerUnit * i.qty, 0);
  const stampFee = soldStamps * (panel.stampRate ?? 4); // ponytail: panels made before the rate bump lack this field, default to the old 4g/stamp so they don't retroactively change
  const totalItemGold = soldItems.reduce(
    (sum, i) => sum + (CATALOG[i.itemKey].type === "quantity" ? i.price : i.price * i.qty),
    0,
  );
  const itemNet = totalItemGold - stampFee;
  const gold8Total = panel.goldEntries.filter((g) => g.splitCount === 8).reduce((sum, g) => sum + g.amount, 0);
  const excludedUids = panel.goldEntries.filter((g) => g.splitCount === 7 && g.excludedUserId).map((g) => g.excludedUserId);
  const pool = itemNet + gold8Total;

  if (sellableItems.length > 0) {
    const totalStamps = sellableItems.reduce((sum, i) => sum + CATALOG[i.itemKey].stampsPerUnit * i.qty, 0);
    lines.push(`• Total stamps: **${totalStamps}** (${stampFee.toLocaleString()}g fee)`);
  }

  // Everyone who is NOT paid the headline figure, whatever the reason — being
  // quietly paid a different number than the one printed above is exactly the
  // failure this block exists to prevent.
  const special = [...new Set([...excludedUids, ...Object.keys(bonuses)])];

  if (soldItems.length > 0 || panel.goldEntries.length > 0 || special.length > 0) {
    const formulaParts = [];
    if (pool > 0) {
      const numParts = [];
      if (totalItemGold > 0) numParts.push(totalItemGold.toLocaleString());
      if (gold8Total > 0) numParts.push(gold8Total.toLocaleString());
      const base = numParts.join(" + ");
      const numerator = (stampFee > 0 && totalItemGold > 0)
        ? `(${base} − ${stampFee.toLocaleString()})`
        : numParts.length > 1 ? `(${base})` : base;
      formulaParts.push(`${numerator} ÷ 8`);
    }
    for (const g of panel.goldEntries.filter((g) => g.splitCount === 7)) {
      formulaParts.push(`${g.amount.toLocaleString()} ÷ 7`);
    }
    // A bonus-only panel has nothing to put in the formula, and printing
    // "( ) − 0.3% tax = 0" over a real payout would be worse than saying nothing.
    if (formulaParts.length) {
      const total = memberSalary(panel, null);
      lines.push(`• **Gaji/orang:** (${formulaParts.join(" + ")}) − 0.3% tax = **${total.toLocaleString()}**`);
    }
    for (const uid of special) {
      const why = [
        excludedUids.includes(uid) && "tidak dapat HC",
        bonuses[uid] && `+${bonuses[uid].toLocaleString()} bonus`,
      ]
        .filter(Boolean)
        .join(", ");
      lines.push(`• **Gaji <@${uid}>: ${memberSalary(panel, uid).toLocaleString()}** (${why})`);
    }
  }

  return lines.length ? lines.join("\n").slice(0, 1024) : null;
}

function statusText(panel) {
  if (panel.members.length === 0) return null;
  return panel.members
    .map((uid) => {
      const received = panel.payments[uid];
      return `${received ? "✅" : "❌"} <@${uid}>${received ? " — received" : ""}`;
    })
    .join("\n")
    .slice(0, 1024);
}

function buildLootEmbed(panel) {
  const embed = new EmbedBuilder()
    .setTitle(`📦 Loot: ${panel.eventTitle}${panel.closed ? " — 🔒 Closed" : ""}`)
    .setColor(panel.closed ? 0x95a5a6 : 0xe67e22);

  const desc = [];
  if (panel.subruns) desc.push(`📍 ${panel.subruns.join(" > ")}`);
  desc.push(`👑 **Host:** <@${panel.hostId}>`);
  desc.push(
    `👤 **Seller:** ${panel.sellerId ? `<@${panel.sellerId}>${panel.sellerIgn ? ` (${panel.sellerIgn})` : ""}` : "_Not set_"}`,
  );
  embed.setDescription(desc.join("\n"));

  embed.addFields({ name: "📦 Items", value: itemsText(panel) });

  const gold = goldText(panel);
  if (gold) embed.addFields({ name: "💰 Gold Drops", value: gold });

  const summary = summaryText(panel);
  if (summary) embed.addFields({ name: "📊 Summary", value: summary });

  const status = statusText(panel);
  if (status) embed.addFields({ name: "💳 Status Gaji", value: status });

  if (!panel.closed) {
    embed.setFooter({ text: `Panel ID: ${panel.lootMsgId}  ·  ✍️ Type Items also accepts gold (e.g. gold 294/7)` });
  }

  return embed;
}

function buildLootComponents(panel) {
  if (panel.closed) return [];

  const hasSeller = !!panel.sellerId;
  const hasItems = panel.items.length > 0;
  const hasGold = panel.goldEntries.length > 0;
  const hasMembers = panel.members.length > 0;

  const btn = (id, label, style) =>
    new ButtonBuilder().setCustomId(`loot-btn:${id}:${panel.lootMsgId}`).setLabel(label).setStyle(style);

  // Before a seller is set, only Set Seller + Add Member show — everything
  // else needs a seller first. Remove-* buttons additionally need something
  // to remove, so they don't show until there's data.
  const row1 = [btn("select_seller", "👤 Seller", ButtonStyle.Secondary).setDisabled(!hasMembers)];
  if (hasSeller) {
    row1.push(btn("add_item", "✍️ Type Items", ButtonStyle.Primary));
    row1.push(btn("browse_item", "📋 Browse Item", ButtonStyle.Secondary));
    if (hasItems) row1.push(btn("remove_item", "🗑️ Remove Item", ButtonStyle.Secondary));
  }

  const row2 = [];
  if (hasSeller) {
    row2.push(btn("set_price", "🏷️ Price All", ButtonStyle.Secondary).setDisabled(!hasItems));
    row2.push(btn("price_one", "🏷️ Price One", ButtonStyle.Secondary).setDisabled(!hasItems));
    row2.push(btn("add_gold", "💰 Add Gold", ButtonStyle.Secondary));
    if (hasGold) row2.push(btn("remove_gold", "🗑️ Remove Gold", ButtonStyle.Secondary));
    // Per-member top-up, so it needs members to aim at. Fills row2 to Discord's
    // five — a sixth gold button needs a row of its own.
    row2.push(btn("bonus_gold", "🎁 Bonus Gold", ButtonStyle.Secondary).setDisabled(!hasMembers));
  }

  const row3 = [btn("add_member", "👥 Add Member", ButtonStyle.Secondary)];
  if (hasSeller && hasMembers) row3.push(btn("remove_member", "➖ Remove Member", ButtonStyle.Secondary));
  // Redraws from the stored panel, changing nothing. Only useful after a deploy
  // that changes the arithmetic: the numbers on screen were computed by the old
  // code and the message will not update itself until someone touches it.
  row3.push(btn("refresh", "🔄 Refresh", ButtonStyle.Secondary));

  const row4 = [];
  if (hasSeller) {
    // Hidden (not just disabled) until allItemsSold — paying before pricing
    // is finalized locks in a stale salaryLog snapshot that never catches up
    // if more items get sold afterward.
    if (allItemsSold(panel)) {
      row4.push(btn("mark_paid", "✅ Mark Paid", ButtonStyle.Success).setDisabled(!hasMembers));
    }
    row4.push(btn("close", "🔒 Close Panel", ButtonStyle.Danger));
  }

  return [row1, row2, row3, row4]
    .filter((row) => row.length > 0)
    .map((row) => new ActionRowBuilder().addComponents(row));
}

async function refreshLootPanel(client, panel) {
  const channel = await client.channels.fetch(panel.threadId);
  const msg = await channel.messages.fetch(panel.lootMsgId);
  await msg.edit({
    content: "",
    embeds: [buildLootEmbed(panel)],
    components: buildLootComponents(panel),
  });
  await updateThreadTitle(channel, panel);
  // Every loot mutation lands here, which makes this the one place the market
  // board has to be told anything. Debounced inside — see app/market.js.
  require("../market").queueMarketSync(client);
}

module.exports = {
  buildLootEmbed,
  buildLootComponents,
  refreshLootPanel,
  salaryPerPerson,
  memberSalary,
  allItemsSold,
  STAMP_RATE_GOLD,
  MAIL_TAX_RATE,
};
