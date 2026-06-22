const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { CATALOG } = require("../items");

const STAMP_RATE_GOLD = 4; // gold per stamp (market fee)

function buildClosedContent(panel) {
  const lines = [`📦 **Loot: ${panel.eventTitle}** — 🔒 Closed\n`];
  if (panel.subruns) lines.push(`📍 ${panel.subruns.join(" > ")}\n`);

  lines.push("📦 **Items:**");
  if (panel.items.length === 0) {
    lines.push("_None_");
  } else {
    for (const item of panel.items) {
      const def = CATALOG[item.itemKey];
      const stamps = def.stampsPerUnit * item.qty;
      const priceStr = item.price != null ? ` — ${item.price.toLocaleString()} gold` : "";
      const detailStr = item.detail ? ` (${item.detail})` : "";
      lines.push(`• ${def.name}${detailStr} — ${item.qty}x — ${stamps} stamps${priceStr}`);
    }
  }

  if (panel.goldEntries.length > 0) {
    lines.push("\n💰 **Gold Drops:**");
    for (const g of panel.goldEntries) {
      const perPerson = Math.floor(g.amount / g.splitCount);
      const excl = g.excludedUserId ? `, <@${g.excludedUserId}> tidak dapat` : "";
      lines.push(`• ${g.amount.toLocaleString()} (÷${g.splitCount}${excl} = ${perPerson.toLocaleString()}/person)`);
    }
  }

  if (panel.items.length > 0 || panel.goldEntries.length > 0) {
    lines.push("\n📊 **Summary:**");
    const soldItems = panel.items.filter((i) => i.price != null);
    const soldStamps = soldItems.reduce((sum, i) => sum + CATALOG[i.itemKey].stampsPerUnit * i.qty, 0);
    const stampFee = soldStamps * STAMP_RATE_GOLD;
    const totalItemGold = soldItems.reduce((sum, i) => sum + i.price * i.qty, 0);
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
    const goldBossDisplay = Math.floor(gold8Total / 8) + gold7PerPerson;

    if (panel.items.length > 0) {
      const totalStamps = panel.items.reduce((sum, i) => sum + CATALOG[i.itemKey].stampsPerUnit * i.qty, 0);
      lines.push(`• Total stamps: **${totalStamps}** (${stampFee.toLocaleString()}g fee)`);
      if (soldItems.length > 0) {
        const unpricedCount = panel.items.length - soldItems.length;
        const note = unpricedCount > 0 ? ` _(${unpricedCount} item belum ada harga)_` : "";
        lines.push(`• Hasil jual: ${totalItemGold.toLocaleString()}g − ${stampFee.toLocaleString()}g = **${itemNet.toLocaleString()}g**${note}`);
      }
    }
    if (panel.goldEntries.length > 0) {
      lines.push(`• Gold raid: **${goldBossDisplay.toLocaleString()}/orang**`);
    }
    if (soldItems.length > 0 || panel.goldEntries.length > 0) {
      lines.push(`• **Gaji/orang: ${(basePerPerson + gold7PerPerson).toLocaleString()}**`);
      for (const uid of excludedUids) {
        lines.push(`• **Gaji <@${uid}>: ${basePerPerson.toLocaleString()}**`);
      }
    }
  }

  if (panel.members.length > 0) {
    lines.push("\n💳 **Status Gaji:**");
    for (const uid of panel.members) {
      const received = panel.payments[uid];
      lines.push(`${received ? "✅" : "❌"} <@${uid}>${received ? " — received" : ""}`);
    }
  }

  return lines.join("\n");
}

function buildLootContent(panel) {
  if (panel.closed) return buildClosedContent(panel);

  const lines = [`📦 **Loot: ${panel.eventTitle}**\n`];

  if (panel.subruns) {
    lines.push(`📍 ${panel.subruns.join(" > ")}`);
  }
  lines.push(`👑 **Host:** <@${panel.hostId}>`);
  lines.push(
    `👤 **Seller:** ${panel.sellerId ? `<@${panel.sellerId}>` : "_Not set_"}\n`,
  );

  // Items
  lines.push("📦 **Items:**");
  if (panel.items.length === 0) {
    lines.push("_None_");
  } else {
    for (const item of panel.items) {
      const def = CATALOG[item.itemKey];
      const stamps = def.stampsPerUnit * item.qty;
      const priceStr =
        item.price != null ? ` — ${item.price.toLocaleString()} gold` : "";
      const detailStr = item.detail ? ` (${item.detail})` : "";
      lines.push(
        `• ${def.name}${detailStr} — ${item.qty}x — ${stamps} stamps${priceStr}`,
      );
    }
  }

  // Gold entries
  if (panel.goldEntries.length > 0) {
    lines.push("\n💰 **Gold Drops:**");
    for (const g of panel.goldEntries) {
      const perPerson = Math.floor(g.amount / g.splitCount);
      const excl = g.excludedUserId
        ? `, <@${g.excludedUserId}> tidak dapat`
        : "";
      lines.push(
        `• ${g.amount.toLocaleString()} (÷${g.splitCount}${excl} = ${perPerson.toLocaleString()}/person)`,
      );
    }
  }

  // Summary
  if (panel.items.length > 0 || panel.goldEntries.length > 0) {
    lines.push("\n📊 **Summary:**");

    // Stamps — total for display, but fee only from sold items
    const totalStamps = panel.items.reduce(
      (sum, item) => sum + CATALOG[item.itemKey].stampsPerUnit * item.qty,
      0,
    );
    const soldItems = panel.items.filter((i) => i.price != null);
    const soldStamps = soldItems.reduce(
      (sum, item) => sum + CATALOG[item.itemKey].stampsPerUnit * item.qty,
      0,
    );
    const stampFee = soldStamps * STAMP_RATE_GOLD;
    const totalItemGold = soldItems.reduce(
      (sum, item) => sum + item.price * item.qty,
      0,
    );
    const itemNet = totalItemGold - stampFee;

    // Gold splits
    const gold8Total = panel.goldEntries
      .filter((g) => g.splitCount === 8)
      .reduce((sum, g) => sum + g.amount, 0);

    let gold7PerPerson = 0;
    const excludedUids = [];
    for (const g of panel.goldEntries.filter((g) => g.splitCount === 7)) {
      gold7PerPerson += Math.floor(g.amount / 7);
      if (g.excludedUserId) excludedUids.push(g.excludedUserId);
    }

    // pool combines item net + ÷8 gold; ÷7 gold is added per-person separately
    const pool = itemNet + gold8Total;
    const basePerPerson = Math.floor(pool / 8);
    const goldBossDisplay = Math.floor(gold8Total / 8) + gold7PerPerson;

    if (panel.items.length > 0) {
      lines.push(
        `• Total stamps: **${totalStamps}** (${stampFee.toLocaleString()}g total fee stamp used for current sold items)`,
      );
      if (soldItems.length > 0) {
        const unpricedCount = panel.items.length - soldItems.length;
        const unpricedNote =
          unpricedCount > 0 ? ` _(${unpricedCount} item belum ada harga)_` : "";
        lines.push(
          `• Hasil jual: ${totalItemGold.toLocaleString()}g − ${stampFee.toLocaleString()}g = **${itemNet.toLocaleString()}g**${unpricedNote}`,
        );
      }
    }

    if (panel.goldEntries.length > 0) {
      lines.push(`• Gold raid: **${goldBossDisplay.toLocaleString()}/orang**`);
    }

    if (soldItems.length > 0 || panel.goldEntries.length > 0) {
      lines.push(
        `• **Gaji/orang: ${(basePerPerson + gold7PerPerson).toLocaleString()}**`,
      );
      for (const uid of excludedUids) {
        lines.push(`• **Gaji <@${uid}>: ${basePerPerson.toLocaleString()}**`);
      }
    }
  }

  // Status penerimaan gaji
  if (panel.members.length > 0) {
    lines.push("\n**Status Gaji:**");
    for (const uid of panel.members) {
      const received = panel.payments[uid];
      lines.push(
        `${received ? "✅" : "❌"} <@${uid}>${received ? " — received salary" : ""}`,
      );
    }
  }

  return lines.join("\n");
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
      .setCustomId(`loot-btn:add_gold:${panel.lootMsgId}`)
      .setLabel("💰 Add Gold")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!panel.sellerId),
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
    content: buildLootContent(panel),
    components: buildLootComponents(panel),
  });
}

module.exports = { buildLootContent, buildLootComponents, refreshLootPanel };
