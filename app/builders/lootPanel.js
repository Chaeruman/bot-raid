const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { CATALOG } = require("../items");

const STAMP_RATE_GOLD = 5; // gold per stamp (market fee) — panels store their own rate at creation, see panel.stampRate
const MAIL_TAX_RATE = 0.003; // 0.3% mail tax, deducted from the final salary

const bonusTotal = (panel) => Object.values(panel.bonuses || {}).reduce((sum, v) => sum + v, 0);

// How many ways the pool splits: whoever is actually on the panel. It used to
// be a hardcoded 8, so a party of seven each got an eighth and the eighth share
// was paid to nobody. Panels made before members were recorded fall back to 8,
// which is what they were computed with — changing an old panel's numbers
// retroactively is worse than an old panel being old.
const partySize = (panel) => panel.members?.length || 8;

// The bonuses come OUT of the run's own gold — usually the GDN Classic drop,
// marked with a leading "!" when it is typed. So the marked entries are drained
// by the bonus pot BEFORE anything is split, and what is left is the pool.
//
// This is what makes the party collectively fund the compensation instead of
// the seller: total gold out is unchanged, it is just shared differently. With
// nothing marked, every entry passes through untouched and the seller covers it,
// which is what panels made before this existed still do.
function fundedGoldEntries(panel) {
  let remaining = bonusTotal(panel);
  if (!remaining) return panel.goldEntries;
  return panel.goldEntries.map((g) => {
    if (!g.bonusSource || remaining <= 0) return g;
    const take = Math.min(remaining, g.amount);
    remaining -= take;
    return { ...g, amount: g.amount - take };
  });
}

// Bonus gold the marked entries could not cover. Not an error — the seller can
// always top it up themselves — but it has to be SAID, because the difference
// between "the party paid" and "you paid" is invisible in the numbers.
function bonusShortfall(panel) {
  const marked = panel.goldEntries.filter((g) => g.bonusSource).reduce((sum, g) => sum + g.amount, 0);
  return Math.max(0, bonusTotal(panel) - marked);
}

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
  // Post-funding: a marked drop has already had the bonus pot taken out of it.
  const entries = fundedGoldEntries(panel);
  const size = partySize(panel);
  // A drop split as many ways as there are people goes into the pool with the
  // items. Anything split fewer ways is HC gold: added per person, at its own
  // divisor, to everyone it does not exclude.
  //
  // Both used to be hardcoded — 8 and 7 — so an entry typed as any other
  // divisor matched neither branch and was paid to NOBODY, while still being
  // printed on the panel and in the formula. `/6` is exactly what a party of
  // seven has to type.
  const poolGold = entries
    .filter((g) => (g.splitCount || size) === size)
    .reduce((sum, g) => sum + g.amount, 0);
  // `!uid` first, and it is not a tidy-up. The headline figure is computed with
  // uid = null, and an entry that excludes nobody is STORED as
  // excludedUserId: null — so `g.excludedUserId !== uid` read null !== null and
  // silently dropped every HC gold drop that had no exclusion, which is most of
  // them. The panel listed the gold, the formula printed it, and nobody was paid
  // it. Never compare an id against a sentinel that is also a real value.
  const hcPerPerson = entries
    .filter((g) => (g.splitCount || size) !== size && (!uid || g.excludedUserId !== uid))
    .reduce((sum, g) => sum + Math.floor(g.amount / g.splitCount), 0);
  // Manual top-up for ONE member, for when the game's own 36g HC/CL mail never
  // arrived and the missing gold has to ride along with their salary instead.
  // It is per-member by definition, so the headline figure (uid = null) never
  // carries it — and it sits inside `gross` so the same 0.3% mail tax applies,
  // because it goes out in the same mail as everything else here.
  const bonus = uid ? panel.bonuses?.[uid] || 0 : 0;
  const gross = Math.floor((itemNet + poolGold) / size) + hcPerPerson + bonus;
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
  // so manual renames are respected and the prefix never stacks. The gold figure
  // is optional in the pattern because the title below sometimes omits it.
  const base = thread.name.replace(/^(?:💵|✅)\s*(?:[\d,]+g\s*—\s*)?/u, "");
  // A panel that owes only per-member bonuses has no per-person figure — the
  // headline is genuinely 0 and nobody is owed it. "0g" in the thread list
  // advertises nothing and reads like a broken payout, so the marker goes up
  // without a number until there is one worth showing.
  const total = salaryPerPerson(panel);
  const name = (total > 0 ? `${emoji} ${total.toLocaleString()}g — ${base}` : `${emoji} ${base}`).slice(0, 100);

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
  const funded = fundedGoldEntries(panel);
  return panel.goldEntries
    .map((g, i) => {
      // What is left after the bonus pot was taken out, which is what actually
      // gets split. Printing the typed number alone would be a lie by omission.
      const left = funded[i].amount;
      const perPerson = Math.floor(left / g.splitCount);
      const excl = g.excludedUserId ? `, <@${g.excludedUserId}> tidak dapat` : "";
      const taken =
        g.bonusSource && left !== g.amount
          ? ` − ${(g.amount - left).toLocaleString()} bonus = ${left.toLocaleString()}`
          : "";
      const mark = g.bonusSource ? " 🎁" : "";
      return `• ${g.amount.toLocaleString()}${taken}${mark} (÷${g.splitCount}${excl} = ${perPerson.toLocaleString()}/person)`;
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
  // The same post-funding view memberSalary uses. Reading the raw entries here
  // would print a formula that disagrees with the total underneath it.
  const entries = fundedGoldEntries(panel);
  const size = partySize(panel);
  const isPool = (g) => (g.splitCount || size) === size;
  const poolGold = entries.filter(isPool).reduce((sum, g) => sum + g.amount, 0);
  const excludedUids = panel.goldEntries.filter((g) => g.excludedUserId).map((g) => g.excludedUserId);
  const pool = itemNet + poolGold;

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
      if (poolGold > 0) numParts.push(poolGold.toLocaleString());
      const base = numParts.join(" + ");
      const numerator = (stampFee > 0 && totalItemGold > 0)
        ? `(${base} − ${stampFee.toLocaleString()})`
        : numParts.length > 1 ? `(${base})` : base;
      formulaParts.push(`${numerator} ÷ ${size}`);
    }
    // The entry's own divisor, not a constant: the printed formula has to be
    // the sum that was actually done, or the panel is quietly lying.
    for (const g of entries.filter((g) => !isPool(g))) {
      formulaParts.push(`${g.amount.toLocaleString()} ÷ ${g.splitCount}`);
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

    // Where the bonus money came from. "The party paid" and "the seller paid"
    // produce identical member numbers and are not the same event, so the panel
    // has to say which one happened.
    const bonusPot = Object.values(bonuses).reduce((sum, v) => sum + v, 0);
    if (bonusPot > 0) {
      const short = bonusShortfall(panel);
      const funded = bonusPot - short;
      if (funded > 0)
        lines.push(`• 🎁 Bonus **${funded.toLocaleString()}g** diambil dari gold bertanda \`!\` (sebelum dibagi)`);
      if (short > 0)
        lines.push(
          `• ⚠️ **${short.toLocaleString()}g** bonus belum ada sumbernya — ditanggung seller. ` +
            "Tandai gold-nya dengan `!` (mis. `!258/8`) kalau mau diambil dari gold run.",
        );
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
  partySize,
  allItemsSold,
  fundedGoldEntries,
  bonusShortfall,
  updateThreadTitle,
  STAMP_RATE_GOLD,
  MAIL_TAX_RATE,
};
