const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { CATALOG } = require("../items");

const STAMP_RATE_GOLD = 4; // gold per stamp (market fee)

function buildLootContent(panel) {
  const lines = [`📦 **Loot: ${panel.eventTitle}**\n`];

  if (panel.subruns) {
    lines.push(`📍 ${panel.subruns.join(" > ")}`);
  }
  lines.push(`👤 **Seller:** ${panel.sellerId ? `<@${panel.sellerId}>` : "_Not set_"}`);
  lines.push(`📌 **Source:** ${panel.source === "raid" ? "📥 Raid Drops" : "✉️ Mail"}\n`);

  // Raid items
  lines.push("📥 **Raid Drops:**");
  if (panel.raidItems.length === 0) {
    lines.push("_None_");
  } else {
    for (const item of panel.raidItems) {
      const def = CATALOG[item.itemKey];
      const stamps = def.stampsPerUnit * item.qty;
      const priceStr = item.price != null ? ` — ${item.price.toLocaleString()} gold` : "";
      const detailStr = item.detail ? ` (${item.detail})` : "";
      lines.push(`• ${def.name}${detailStr} — ${item.qty}x — ${stamps} stamps${priceStr}`);
    }
  }

  // Mail items
  lines.push("\n✉️ **Mail:**");
  if (panel.mailItems.length === 0) {
    lines.push("_None_");
  } else {
    for (const item of panel.mailItems) {
      const def = CATALOG[item.itemKey];
      const stamps = def.stampsPerUnit * item.qty;
      const priceStr = item.price != null ? ` — ${item.price.toLocaleString()} gold` : "";
      const detailStr = item.detail ? ` (${item.detail})` : "";
      lines.push(`• ${def.name}${detailStr} — ${item.qty}x — ${stamps} stamps${priceStr}`);
    }
  }

  // Gold entries
  if (panel.goldEntries.length > 0) {
    lines.push("\n💰 **Gold Drops:**");
    for (const g of panel.goldEntries) {
      const perPerson = Math.floor(g.amount / g.splitCount);
      const src = g.source === "raid" ? "Raid" : "Mail";
      lines.push(`• ${src}: ${g.amount.toLocaleString()} (÷${g.splitCount} = ${perPerson.toLocaleString()}/person)`);
    }
  }

  // Summary
  const allItems = [...panel.raidItems, ...panel.mailItems];
  if (allItems.length > 0 || panel.goldEntries.length > 0) {
    lines.push("\n📊 **Summary:**");

    const memberCount = panel.members.length || 8;
    let itemsPerPerson = 0;

    if (allItems.length > 0) {
      const totalStamps = allItems.reduce((sum, item) => {
        return sum + CATALOG[item.itemKey].stampsPerUnit * item.qty;
      }, 0);
      const pricedItems = allItems.filter((i) => i.price != null);
      const stampFee = totalStamps * STAMP_RATE_GOLD;

      lines.push(`• Total stamps: **${totalStamps}** (${stampFee.toLocaleString()}g fee)`);

      if (pricedItems.length > 0) {
        const totalItemGold = pricedItems.reduce((sum, item) => sum + item.price * item.qty, 0);
        const net = totalItemGold - stampFee;
        itemsPerPerson = Math.floor(net / memberCount);
        const unpricedCount = allItems.length - pricedItems.length;
        const unpricedNote = unpricedCount > 0 ? ` _(${unpricedCount} item(s) unpriced)_` : "";
        lines.push(`• Items: ${totalItemGold.toLocaleString()}g − ${stampFee.toLocaleString()}g = **${net.toLocaleString()}g** ÷ ${memberCount} = **${itemsPerPerson.toLocaleString()}/person**${unpricedNote}`);
      }
    }

    const goldPerPerson = panel.goldEntries.reduce((sum, g) => {
      return sum + Math.floor(g.amount / g.splitCount);
    }, 0);

    if (goldPerPerson > 0) {
      lines.push(`• Gold drops: **${goldPerPerson.toLocaleString()}/person**`);
    }

    const totalPerPerson = itemsPerPerson + goldPerPerson;
    if (totalPerPerson > 0) {
      lines.push(`• **Total/person: ${totalPerPerson.toLocaleString()}**`);
    }
  }

  // Payment status
  if (panel.members.length > 0) {
    lines.push("\n💳 **Payment Status:**");
    for (const uid of panel.members) {
      const paid = panel.payments[uid];
      lines.push(`${paid ? "✅" : "❌"} <@${uid}>${paid ? " — paid" : ""}`);
    }
  }

  if (panel.closed) lines.push("\n🔒 **Loot panel closed.**");

  return lines.join("\n");
}

function buildLootComponents(panel) {
  if (panel.closed) return [];

  const hasItems = panel.raidItems.length > 0 || panel.mailItems.length > 0;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`loot-btn:select_seller:${panel.lootMsgId}`)
      .setLabel("👤 Seller")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`loot-btn:add_item:${panel.lootMsgId}`)
      .setLabel("➕ Add Item")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!panel.sellerId),
    new ButtonBuilder()
      .setCustomId(`loot-btn:add_gold:${panel.lootMsgId}`)
      .setLabel("💰 Add Gold")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!panel.sellerId),
    new ButtonBuilder()
      .setCustomId(`loot-btn:switch_source:${panel.lootMsgId}`)
      .setLabel(panel.source === "raid" ? "✉️ Mail" : "📥 Raid")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!panel.sellerId),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`loot-btn:set_price:${panel.lootMsgId}`)
      .setLabel("🏷️ Set Price")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!panel.sellerId || !hasItems),
    new ButtonBuilder()
      .setCustomId(`loot-btn:mark_paid:${panel.lootMsgId}`)
      .setLabel("✅ Mark Paid")
      .setStyle(ButtonStyle.Success),
  );

  return [row1, row2];
}

async function refreshLootPanel(client, panel) {
  const channel = await client.channels.fetch(panel.threadId);
  const msg = await channel.messages.fetch(panel.lootMsgId);
  await msg.edit({
    content: buildLootContent(panel),
    components: buildLootComponents(panel),
  });
}

module.exports = { buildLootContent, buildLootComponents, refreshLootPanel };
