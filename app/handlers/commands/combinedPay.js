const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { activeLootPanels, saveState, recordSalaryPaid } = require("../../state");
const { memberSalary, refreshLootPanel, MAIL_TAX_RATE } = require("../../builders/lootPanel");
const { checkTop5Records } = require("../../salaryRecords");

// My open panels = panels I'm the seller of that aren't closed, whose thread
// is still open too (not archived/locked — e.g. auto-archived after inactivity),
// and every item is priced (payment-ready) — a panel still being priced
// shouldn't show up here and risk mark-paid colliding with in-progress pricing.
async function myPanels(client, sellerId) {
  const candidates = Object.values(activeLootPanels).filter(
    (p) => p.sellerId === sellerId && !p.closed && p.items.every((i) => i.price != null),
  );
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

function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [...combinations(rest, k - 1).map((c) => [first, ...c]), ...combinations(rest, k)];
}

// Best subset of exactly maxCount uids (or fewer only if no maxCount-sized
// combo fits) whose total salary is the highest value not exceeding budget.
// Maximizing headcount comes first — with a hard daily mail limit, leaving a
// slot unused is wasted capacity even if a smaller combo lands closer to the
// budget total. Only falls back to fewer people when nothing at that size fits.
function bestComboUnderBudget(agg, uids, budget, maxCount = 3) {
  for (let k = Math.min(maxCount, uids.length); k >= 1; k--) {
    let best = null;
    for (const combo of combinations(uids, k)) {
      const total = combo.reduce((sum, uid) => sum + agg[uid].total, 0);
      if (total <= budget && (!best || total > best.total)) best = { uids: combo, total };
    }
    if (best) return best;
  }
  return null;
}

// Builds the "who's still unpaid" reply — used both for the initial /kirim-gaji
// reply and to refresh the same message after a partial mark-paid (sellers
// often assign a few at a time, not everyone at once).
// budget: optional gold-on-hand for one character — pre-selects the best
// ≤3-member combo that fits it (mail limit is 3 sends/day/character).
// Returns null when nobody's left unpaid.
async function buildUnpaidView(client, guild, sellerId, budget = null) {
  const panels = await myPanels(client, sellerId);
  const agg = aggregate(panels);
  const uids = Object.keys(agg);
  if (uids.length === 0) return null;

  // Sending mail costs a 0.3% tax on top, so the usable budget for the combo
  // search is a bit less than the raw gold on hand.
  const effectiveBudget = budget != null ? Math.floor(budget * (1 - MAIL_TAX_RATE)) : null;
  const recommended = effectiveBudget != null ? bestComboUnderBudget(agg, uids, effectiveBudget, 3) : null;
  const recommendedSet = new Set(recommended ? recommended.uids : []);

  const options = await Promise.all(
    uids.slice(0, 25).map(async (uid) => {
      let label = uid;
      try {
        label = (await guild.members.fetch(uid)).displayName;
      } catch { /* fallback to id */ }
      return {
        label: label.slice(0, 100),
        value: uid,
        description: `${agg[uid].total.toLocaleString()}g dari ${agg[uid].count} panel`,
        default: recommendedSet.has(uid),
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
    .map((o) => `${o.default ? "⭐" : "•"} **${o.label}** — ${agg[o.value].total.toLocaleString()}g (${agg[o.value].count} panel)`)
    .join("\n");

  const panelLinks = panels
    .map((p) => `• [${p.eventTitle}](https://discord.com/channels/${guild.id}/${p.threadId}/${p.lootMsgId})`)
    .join("\n");

  let budgetNote = "";
  if (budget != null) {
    budgetNote = recommended
      ? `\n\n💡 **Rekomendasi buat budget ${budget.toLocaleString()}g** (setelah pajak mail 0.3%: ${effectiveBudget.toLocaleString()}g, maks 3 orang limit mail): ${recommended.uids.map((uid) => `<@${uid}>`).join(", ")} = **${recommended.total.toLocaleString()}g** (sisa ${(effectiveBudget - recommended.total).toLocaleString()}g). Sudah kepilih otomatis di menu di bawah — tinggal submit atau ubah manual.`
      : `\n\n⚠️ Nggak ada member yang gajinya muat di budget ${budget.toLocaleString()}g (efektif ${effectiveBudget.toLocaleString()}g setelah pajak mail).`;
  }

  const content = `💸 **Kirim Gaji** — daftar gaji belum dibayar di ${panels.length} panel milik kamu:\n${list}\n\n**Panel:**\n${panelLinks}${budgetNote}\n\nPilih member yang sudah kamu kirim gajinya → ditandai lunas di semua panel sekaligus.`;
  return { content, components: [row] };
}

async function handleCombinedPay(interaction) {
  const budget = interaction.options.getInteger("budget");
  const view = await buildUnpaidView(interaction.client, interaction.guild, interaction.user.id, budget);
  if (!view) {
    return interaction.reply({
      content: "🤷 Tidak ada panel terbuka (thread aktif, belum lock) dengan seller kamu yang masih punya member belum dibayar.",
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({
    content: view.content.slice(0, 2000),
    components: view.components,
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
        if (p.stampRate != null) {
          recordSalaryPaid(p.lootMsgId, uid, memberSalary(p, uid), {
            sellerId: p.sellerId,
            panelTitle: p.eventTitle,
            threadId: p.threadId,
          });
        }
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
      if (p.stampRate != null) checkTop5Records(interaction.client, p).catch((err) => console.error("❌ checkTop5Records failed:", err.message));
    }
  }
  saveState();

  const closedNote = closedNames.length ? `\n🔒 Panel lunas & ditutup: ${closedNames.join(", ")}` : "";
  const doneMsg = `✅ Ditandai lunas di ${touched.size} panel.${closedNote}`;

  // Still more unpaid members left (sellers often assign a few at a time)?
  // Refresh the same message with who's left instead of closing it out.
  const view = await buildUnpaidView(interaction.client, interaction.guild, sellerId);
  if (!view) {
    return interaction.update({ content: `${doneMsg}\n\n🎉 Semua member sudah lunas.`.slice(0, 2000), components: [] });
  }
  return interaction.update({
    content: `${doneMsg}\n\n${view.content}`.slice(0, 2000),
    components: view.components,
  });
}

module.exports = { handleCombinedPay, handleCombinedPaySelect, aggregate, myPanels, buildUnpaidView, bestComboUnderBudget };
