const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { activeLootPanels, saveState, recordSalaryPaid } = require("../../state");
const { memberSalary, salaryPerPerson, refreshLootPanel, allItemsSold, MAIL_TAX_RATE } = require("../../builders/lootPanel");
const { checkTop5Records } = require("../../salaryRecords");

// My open panels = panels I'm the seller of that aren't closed, whose thread
// is still open too (not archived/locked — e.g. auto-archived after inactivity),
// and that are payment-ready. `allItemsSold()` is the single source of truth
// for that (same check the panel's own Mark Paid button uses): every sellable
// item priced AND something actually there to pay out, so a panel with nothing
// but gacha giveaways — or nothing at all yet — doesn't show up with 0g.
async function myPanels(client, sellerId) {
  const candidates = Object.values(activeLootPanels).filter(
    (p) => p.sellerId === sellerId && !p.closed && allItemsSold(p),
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

// uid -> { total, panelNums } of exact unpaid salary across my open panels
// (HC-exclusion aware). panelNums are 1-based positions in `panels`, matching
// the numbered panel list in the reply, so a member's row can link straight to
// the panels they're still owed from. Count is just panelNums.length — kept as
// one field so the two can't drift apart.
function aggregate(panels) {
  const agg = {};
  panels.forEach((p, i) => {
    for (const uid of p.members) {
      if (p.payments[uid]) continue;
      (agg[uid] ??= { total: 0, panelNums: [] });
      agg[uid].total += memberSalary(p, uid);
      agg[uid].panelNums.push(i + 1);
    }
  });
  return agg;
}

// Some members set their Discord nickname as "IGN - something else" (class,
// note, etc). Only the IGN part is useful for copy-pasting into the game's
// mail recipient field, so trim the rest off. Nicknames without " - " (no
// alias set — perfectly normal) pass through unchanged.
function ignOnly(name) {
  const idx = name.indexOf(" - ");
  if (idx === -1) return name;
  return name.slice(0, idx).trim() || name;
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

// Cheapest possible total across all combos of exactly `count` uids — the
// minimum budget needed to unlock a combo of that size at all.
function cheapestComboTotal(agg, uids, count) {
  let min = null;
  for (const combo of combinations(uids, count)) {
    const total = combo.reduce((sum, uid) => sum + agg[uid].total, 0);
    if (min == null || total < min) min = total;
  }
  return min;
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

  // Kept separate from `options` below — hasAlias isn't a valid Discord
  // select-option field, only used to annotate the printed list.
  const memberInfo = await Promise.all(
    uids.slice(0, 25).map(async (uid) => {
      let label = uid;
      let hasAlias = true; // fallback-to-uid case: not a real IGN either, but no need to nag about it
      try {
        const rawName = (await guild.members.fetch(uid)).displayName;
        label = ignOnly(rawName);
        hasAlias = label !== rawName;
      } catch { /* fallback to id */ }
      return { uid, label: label.slice(0, 100), hasAlias };
    }),
  );

  const options = memberInfo.map((m) => ({
    label: m.label,
    value: m.uid,
    description: `${agg[m.uid].total.toLocaleString()}g dari ${agg[m.uid].panelNums.length} panel`,
    default: recommendedSet.has(m.uid),
  }));

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`gab:${sellerId}`)
      .setPlaceholder("Pilih member untuk ditandai lunas di semua panel")
      .setMinValues(1)
      .setMaxValues(options.length)
      .addOptions(options),
  );

  // Parens (not bold **) around the name — punctuation gives double-click a
  // clean word boundary so copying the IGN doesn't drag the trailing space in.
  // ⭐ (recommended) and ⚠️ (no IGN alias) are independent — both show
  // together when they both apply, neither hides the other.
  // Which of the seller's own game characters owe this member. Mail limit is
  // per character, so the IGN — not the panel — is what decides which one to
  // log into. Deduped: two panels sold on the same character are one trip.
  const sellerIgns = (uid) => [...new Set(agg[uid].panelNums.map((n) => panels[n - 1].sellerIgn || "?"))];

  const list = memberInfo
    .map((m) => {
      const bullet = (recommendedSet.has(m.uid) ? "⭐" : "•") + (m.hasAlias ? "" : "⚠️");
      // Plain text, no italic underscores — those kept colliding with the
      // escaped "_balance" underscore elsewhere on the line and leaving a
      // stray literal "_" visible instead of rendering as italic.
      const note = m.hasAlias ? "" : " (bukan IGN mereka)";
      // Panel count and IGN list are deliberately both here: the IGNs are
      // deduped, so "2 panel [ santenaz ]" is a real case (same character sold
      // both). The count answers "how many", the IGNs "which character".
      // "_balance" glued on with no space — double-click grabs the whole
      // "Ng_balance" token cleanly instead of stopping at "N" or "g". The
      // underscore is escaped (\_) so Discord doesn't eat it as an italic
      // delimiter (which also swallowed the literal char and, paired with
      // the note's own _..._ italics elsewhere on the line, italicized
      // everything in between).
      return `${bullet} (${m.label})${note} — ${agg[m.uid].total.toLocaleString()}g\\_balance (${agg[m.uid].panelNums.length} panel) [ ${sellerIgns(m.uid).join(" | ")} ]`;
    })
    .join("\n");

  // Link text is just the seller IGN — the raid name and timestamp were long
  // and told the seller nothing they act on; the IGN is what they need.
  // Prefixed with that panel's headline salary (same figure as the thread
  // title) and suffixed with when it ran, so panels sold on the same
  // character are still tellable apart.
  // Raid titles are "<label> — <date> <time> WIB"; year and WIB are noise
  // here. Standalone /loot panels have a free-form title with no " — ", so
  // they just get no date.
  const panelWhen = (p) => {
    const idx = p.eventTitle.indexOf(" — ");
    if (idx === -1) return null;
    return p.eventTitle.slice(idx + 3).replace(/ \d{4}/, "").replace(/ WIB$/, "");
  };

  const panelLinks = panels
    .map((p) => {
      const when = panelWhen(p);
      const url = `https://discord.com/channels/${guild.id}/${p.threadId}/${p.lootMsgId}`;
      return `• ${salaryPerPerson(p).toLocaleString()}g/org - [${p.sellerIgn || "IGN belum diset"}](${url})${when ? ` (${when})` : ""}`;
    })
    .join("\n");

  let budgetNote = "";
  if (budget != null) {
    budgetNote = recommended
      ? `\n\n💡 **Rekomendasi buat budget ${budget.toLocaleString()}g** (setelah pajak mail 0.3%: ${effectiveBudget.toLocaleString()}g, maks 3 orang limit mail): ${recommended.uids.map((uid) => `<@${uid}>`).join(", ")} = **${recommended.total.toLocaleString()}g** (sisa ${(effectiveBudget - recommended.total).toLocaleString()}g). Sudah kepilih otomatis di menu di bawah — tinggal submit atau ubah manual.`
      : `\n\n⚠️ Nggak ada member yang gajinya muat di budget ${budget.toLocaleString()}g (efektif ${effectiveBudget.toLocaleString()}g setelah pajak mail).`;

    // Budget only stretches to fewer than 3 people (or 0) even though 3+ are
    // unpaid — point out the minimum raw budget that would unlock a full
    // 3-person combo, so the seller knows exactly how much more to bring.
    const targetCount = Math.min(3, uids.length);
    if (targetCount >= 2 && (!recommended || recommended.uids.length < targetCount)) {
      const cheapest = cheapestComboTotal(agg, uids, targetCount);
      if (cheapest != null) {
        const minRawBudget = Math.ceil(cheapest / (1 - MAIL_TAX_RATE));
        budgetNote += `\n📈 Coba naikin budget ke minimal **${minRawBudget.toLocaleString()}g** biar bisa bayar ke ${targetCount} orang sekaligus (limit mail).`;
      }
    }
  }

  const actionButtons = [
    new ButtonBuilder()
      .setCustomId(`gab-budget:${sellerId}`)
      .setLabel(budget != null ? "🔄 Budget Lain" : "🧮 Cek Budget")
      .setStyle(ButtonStyle.Secondary),
  ];
  // Recommendation exists → a one-click button that pays it directly, no
  // need to touch the select menu at all (opening + closing it without
  // changing anything doesn't submit — Discord only fires on an actual change).
  if (recommended) {
    actionButtons.unshift(
      new ButtonBuilder()
        .setCustomId(`gab-paid-rec:${sellerId}:${budget}`)
        .setLabel(`✅ Mark Paid Rekomendasi (${recommended.uids.length})`)
        .setStyle(ButtonStyle.Success),
    );
  }
  const budgetButtonRow = new ActionRowBuilder().addComponents(actionButtons);

  const content = `💸 **Kirim Gaji** — daftar gaji belum dibayar di ${panels.length} panel milik kamu:\n${list}\n\n**Panel:**\n${panelLinks}${budgetNote}\n\nPilih member yang sudah kamu kirim gajinya → ditandai lunas di semua panel sekaligus.`;
  return { content, components: [row, budgetButtonRow] };
}

// Marks `picked` uids paid across all of this seller's open panels, closes
// any panel that becomes fully paid, records salary + top5 checks. Shared by
// the select-menu handler and the "Mark Paid Rekomendasi" button.
async function markPaidForUids(client, sellerId, picked) {
  const panels = await myPanels(client, sellerId);
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
    await refreshLootPanel(client, p).catch(() => {});
    if (p.closed) {
      closedNames.push(p.eventTitle);
      delete activeLootPanels[p.lootMsgId];
      if (p.stampRate != null) checkTop5Records(client, p).catch((err) => console.error("❌ checkTop5Records failed:", err.message));
    }
  }
  saveState();

  return { touchedCount: touched.size, closedNames };
}

async function handleCombinedPay(interaction, budget = interaction.options?.getInteger("budget") ?? null) {
  // Fetching every candidate panel's thread + every unpaid member's guild
  // profile can take longer than Discord's 3s ack window — defer first so
  // the interaction doesn't die with "Interaction failed" while this runs.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const view = await buildUnpaidView(interaction.client, interaction.guild, interaction.user.id, budget);
  if (!view) {
    return interaction.editReply({
      content: "🤷 Tidak ada panel terbuka (thread aktif, belum lock) dengan seller kamu yang masih punya member belum dibayar.",
    });
  }

  return interaction.editReply({
    content: view.content.slice(0, 2000),
    components: view.components,
  });
}

// customId: gab:{sellerId}
async function handleCombinedPaySelect(interaction) {
  const sellerId = interaction.customId.slice("gab:".length);
  if (interaction.user.id !== sellerId) {
    return interaction.reply({ content: "⛔ Bukan panel kamu.", flags: MessageFlags.Ephemeral });
  }
  // Same 3s-ack risk as the command — marking paid touches every affected
  // panel's thread, and rebuilding the view fetches member profiles again.
  await interaction.deferUpdate();

  const { touchedCount, closedNames } = await markPaidForUids(interaction.client, sellerId, new Set(interaction.values));
  const closedNote = closedNames.length ? `\n🔒 Panel lunas & ditutup: ${closedNames.join(", ")}` : "";
  const doneMsg = `✅ Ditandai lunas di ${touchedCount} panel.${closedNote}`;

  // Still more unpaid members left (sellers often assign a few at a time)?
  // Refresh the same message with who's left instead of closing it out.
  const view = await buildUnpaidView(interaction.client, interaction.guild, sellerId);
  if (!view) {
    return interaction.editReply({ content: `${doneMsg}\n\n🎉 Semua member sudah lunas.`.slice(0, 2000), components: [] });
  }
  return interaction.editReply({
    content: `${doneMsg}\n\n${view.content}`.slice(0, 2000),
    components: view.components,
  });
}

// customId: gab-paid-rec:{sellerId}:{budget}
// One-click "pay the recommended combo" — recomputes the recommendation
// fresh at click time (state may have shifted since the message was shown)
// instead of trusting a stale uid list baked into the customId.
async function handleGabMarkPaidRec(interaction) {
  const [, sellerId, budgetStr] = interaction.customId.split(":");
  if (interaction.user.id !== sellerId) {
    return interaction.reply({ content: "⛔ Bukan panel kamu.", flags: MessageFlags.Ephemeral });
  }
  await interaction.deferUpdate();

  const budget = parseInt(budgetStr, 10);
  const panels = await myPanels(interaction.client, sellerId);
  const agg = aggregate(panels);
  const uids = Object.keys(agg);
  const effectiveBudget = Math.floor(budget * (1 - MAIL_TAX_RATE));
  const recommended = bestComboUnderBudget(agg, uids, effectiveBudget, 3);

  if (!recommended) {
    return interaction.followUp({
      content: "⚠️ Nggak ada kombinasi yang muat lagi di budget ini (kemungkinan sudah berubah) — coba Budget Lain.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const { touchedCount, closedNames } = await markPaidForUids(interaction.client, sellerId, new Set(recommended.uids));
  const closedNote = closedNames.length ? `\n🔒 Panel lunas & ditutup: ${closedNames.join(", ")}` : "";
  const doneMsg = `✅ Ditandai lunas ke ${recommended.uids.map((uid) => `<@${uid}>`).join(", ")} (${touchedCount} panel).${closedNote}`;

  const view = await buildUnpaidView(interaction.client, interaction.guild, sellerId);
  if (!view) {
    return interaction.editReply({ content: `${doneMsg}\n\n🎉 Semua member sudah lunas.`.slice(0, 2000), components: [] });
  }
  return interaction.editReply({
    content: `${doneMsg}\n\n${view.content}`.slice(0, 2000),
    components: view.components,
  });
}

module.exports = {
  handleCombinedPay,
  handleCombinedPaySelect,
  handleGabMarkPaidRec,
  aggregate,
  myPanels,
  buildUnpaidView,
  bestComboUnderBudget,
  cheapestComboTotal,
  ignOnly,
};
