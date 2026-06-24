const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { CATALOG } = require("../items");

const STAMP_RATE_GOLD = 4; // gold per stamp (market fee)

// Headline salary per person (base ÷8 pool share + per-person ÷7 HC gold).
function salaryPerPerson(panel) {
  const soldItems = panel.items.filter((i) => i.price != null);
  const soldStamps = soldItems.reduce((sum, i) => sum + CATALOG[i.itemKey].stampsPerUnit * i.qty, 0);
  const stampFee = soldStamps * STAMP_RATE_GOLD;
  const totalItemGold = soldItems.reduce(
    (sum, i) => sum + (CATALOG[i.itemKey].type === "quantity" ? i.price : i.price * i.qty),
    0,
  );
  const itemNet = totalItemGold - stampFee;
  const gold8Total = panel.goldEntries.filter((g) => g.splitCount === 8).reduce((sum, g) => sum + g.amount, 0);
  const gold7PerPerson = panel.goldEntries
    .filter((g) => g.splitCount === 7)
    .reduce((sum, g) => sum + Math.floor(g.amount / 7), 0);
  return Math.floor((itemNet + gold8Total) / 8) + gold7PerPerson;
}

function allItemsSold(panel) {
  return panel.items.length > 0 && panel.items.every((i) => i.price != null);
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
      const stamps = def.stampsPerUnit * item.qty;
      const priceStr = item.price != null
        ? ` — ${item.price.toLocaleString()} gold${def.type === "quantity" ? " total" : ""}`
        : "";
      const detailStr = item.detail ? ` (${item.detail})` : "";
      const noteStr = item.note ? ` _(${item.note})_` : "";
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
  if (panel.items.length === 0 && panel.goldEntries.length === 0) return null;

  const lines = [];
  const soldItems = panel.items.filter((i) => i.price != null);
  const soldStamps = soldItems.reduce((sum, i) => sum + CATALOG[i.itemKey].stampsPerUnit * i.qty, 0);
  const stampFee = soldStamps * STAMP_RATE_GOLD;
  const totalItemGold = soldItems.reduce(
    (sum, i) => sum + (CATALOG[i.itemKey].type === "quantity" ? i.price : i.price * i.qty),
    0,
  );
  const itemNet = totalItemGold - stampFee;
  const gold8Total = panel.goldEntries.filter((g) => g.splitCount === 8).reduce((sum, g) => sum + g.amount, 0);
  let gold7PerPerson = 0;
  const excludedUids = [];
  for (const g of panel.goldEntries.filter((g) => g.splitCount === 7)) {
    gold7PerPerson += Math.floor(g.amount / 7);
    if (g.excludedUserId) excludedUids.push(g.excludedUserId);
  }
  const pool = itemNet + gold8Total;
  const basePerPerson = Math.floor(pool / 8);

  if (panel.items.length > 0) {
    const totalStamps = panel.items.reduce((sum, i) => sum + CATALOG[i.itemKey].stampsPerUnit * i.qty, 0);
    lines.push(`• Total stamps: **${totalStamps}** (${stampFee.toLocaleString()}g fee)`);
  }

  if (soldItems.length > 0 || panel.goldEntries.length > 0) {
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
    const total = basePerPerson + gold7PerPerson;
    lines.push(`• **Gaji/orang:** ${formulaParts.join(" + ")} = **${total.toLocaleString()}**`);
    for (const uid of excludedUids) {
      lines.push(`• **Gaji <@${uid}>: ${basePerPerson.toLocaleString()}** (tidak dapat HC)`);
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
  desc.push(`👤 **Seller:** ${panel.sellerId ? `<@${panel.sellerId}>` : "_Not set_"}`);
  embed.setDescription(desc.join("\n"));

  embed.addFields({ name: "📦 Items", value: itemsText(panel) });

  const gold = goldText(panel);
  if (gold) embed.addFields({ name: "💰 Gold Drops", value: gold });

  const summary = summaryText(panel);
  if (summary) embed.addFields({ name: "📊 Summary", value: summary });

  const status = statusText(panel);
  if (status) embed.addFields({ name: "💳 Status Gaji", value: status });

  return embed;
}

function buildLootComponents(panel) {
  if (panel.closed) return [];

  const hasItems = panel.items.length > 0;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`loot-btn:select_seller:${panel.lootMsgId}`)
      .setLabel("👤 Seller")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(panel.members.length === 0),
    new ButtonBuilder()
      .setCustomId(`loot-btn:add_item:${panel.lootMsgId}`)
      .setLabel("➕ Add Item")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!panel.sellerId),
    new ButtonBuilder()
      .setCustomId(`loot-btn:remove_item:${panel.lootMsgId}`)
      .setLabel("🗑️ Remove Item")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!panel.sellerId || !hasItems),
    new ButtonBuilder()
      .setCustomId(`loot-btn:add_gold:${panel.lootMsgId}`)
      .setLabel("💰 Add Gold")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!panel.sellerId),
    new ButtonBuilder()
      .setCustomId(`loot-btn:remove_gold:${panel.lootMsgId}`)
      .setLabel("🗑️ Remove Gold")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!panel.sellerId || panel.goldEntries.length === 0),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`loot-btn:set_price:${panel.lootMsgId}`)
      .setLabel("🏷️ Set Item Price")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!panel.sellerId || !hasItems),
    new ButtonBuilder()
      .setCustomId(`loot-btn:mark_paid:${panel.lootMsgId}`)
      .setLabel("✅ Mark Paid")
      .setStyle(ButtonStyle.Success)
      .setDisabled(panel.members.length === 0),
    new ButtonBuilder()
      .setCustomId(`loot-btn:close:${panel.lootMsgId}`)
      .setLabel("🔒 Close Panel")
      .setStyle(ButtonStyle.Danger),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`loot-btn:add_member:${panel.lootMsgId}`)
      .setLabel("👥 Add Member")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`loot-btn:remove_member:${panel.lootMsgId}`)
      .setLabel("➖ Remove Member")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(panel.members.length === 0),
  );

  return [row1, row2, row3];
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
}

module.exports = { buildLootEmbed, buildLootComponents, refreshLootPanel };
