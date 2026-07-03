const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { activeLootPanels, saveState } = require("../../state");
const { memberSalary, refreshLootPanel } = require("../../builders/lootPanel");

// My open panels = panels I'm the seller of that aren't closed, whose thread
// is still open too (not archived/locked — e.g. auto-archived after inactivity).
async function myPanels(client, sellerId) {
  const candidates = Object.values(activeLootPanels).filter((p) => p.sellerId === sellerId && !p.closed);
  const checks = await Promise.all(
    candidates.map(async (p) => {
      try {
        const thread = await client.channels.fetch(p.threadId);
        return thread.archived || thread.locked ? null : p;
      } catch {
        return null; // thread gone — skip it
      }
    }),
  );
  return checks.filter(Boolean);
}

// uid -> { total, count } of exact unpaid salary across my open panels (HC-exclusion aware).
function aggregate(panels) {
  const agg = {};
  for (const p of panels) {
    for (const uid of p.members) {
      if (p.payments[uid]) continue;
      (agg[uid] ??= { total: 0, count: 0 });
      agg[uid].total += memberSalary(p, uid);
      agg[uid].count += 1;
    }
  }
  return agg;
}

async function handleCombinedPay(interaction) {
  const sellerId = interaction.user.id;
  const panels = await myPanels(interaction.client, sellerId);
  const agg = aggregate(panels);
  const uids = Object.keys(agg);

  if (uids.length === 0) {
    return interaction.reply({
      content: "🤷 Tidak ada panel terbuka (thread aktif, belum lock) dengan seller kamu yang masih punya member belum dibayar.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const options = await Promise.all(
    uids.slice(0, 25).map(async (uid) => {
      let label = uid;
      try {
        label = (await interaction.guild.members.fetch(uid)).displayName;
      } catch { /* fallback to id */ }
      return {
        label: label.slice(0, 100),
        value: uid,
        description: `${agg[uid].total.toLocaleString()}g dari ${agg[uid].count} panel`,
      };
    }),
  );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`gab:${sellerId}`)
      .setPlaceholder("Pilih member untuk ditandai lunas di semua panel")
      .setMinValues(1)
      .setMaxValues(options.length)
      .addOptions(options),
  );

  const list = options
    .map((o) => `• **${o.label}** — ${agg[o.value].total.toLocaleString()}g (${agg[o.value].count} panel)`)
    .join("\n");

  const panelLinks = panels
    .map((p) => `• [${p.eventTitle}](https://discord.com/channels/${interaction.guildId}/${p.threadId}/${p.lootMsgId})`)
    .join("\n");

  return interaction.reply({
    content: `💸 **Kirim Gaji** — daftar gaji belum dibayar di ${panels.length} panel milik kamu:\n${list}\n\n**Panel:**\n${panelLinks}\n\nPilih member yang sudah kamu kirim gajinya → ditandai lunas di semua panel sekaligus.`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

// customId: gab:{sellerId}
async function handleCombinedPaySelect(interaction) {
  const sellerId = interaction.customId.slice("gab:".length);
  if (interaction.user.id !== sellerId) {
    return interaction.reply({ content: "⛔ Bukan panel kamu.", flags: MessageFlags.Ephemeral });
  }

  const picked = new Set(interaction.values);
  const panels = await myPanels(interaction.client, sellerId);
  const touched = new Set();

  for (const p of panels) {
    for (const uid of p.members) {
      if (picked.has(uid) && !p.payments[uid]) {
        p.payments[uid] = true;
        touched.add(p);
      }
    }
  }

  const closedNames = [];
  for (const p of touched) {
    if (p.members.length > 0 && p.members.every((uid) => p.payments[uid])) {
      p.closed = true;
    }
    await refreshLootPanel(interaction.client, p).catch(() => {});
    if (p.closed) {
      closedNames.push(p.eventTitle);
      delete activeLootPanels[p.lootMsgId];
    }
  }
  saveState();

  const closedNote = closedNames.length ? `\n🔒 Panel lunas & ditutup: ${closedNames.join(", ")}` : "";
  return interaction.update({
    content: `✅ Ditandai lunas di ${touched.size} panel.${closedNote}`,
    components: [],
  });
}

module.exports = { handleCombinedPay, handleCombinedPaySelect, aggregate, myPanels };
