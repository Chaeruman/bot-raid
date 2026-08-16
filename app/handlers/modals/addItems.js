const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { activeLootPanels, saveState, setPendingResolution, recordParseFail } = require("../../state");
const { CATALOG } = require("../../items");
const { refreshLootPanel } = require("../../builders/lootPanel");
const { parseItemLines, formatParseError } = require("../../utils/parseItems");

function addToPanel(panel, it) {
  // "unique" items (equipment, runes, accessories) never merge — each drop
  // is a distinct physical item that may end up sold to a different buyer
  // at a different price, so qty must stay 1 per line. "quantity" items
  // (fragments) are fungible and still stack, matched by note/notForSale
  // too — different notes/status mean the seller wants them tracked (and
  // displayed) separately, e.g. one copy sold and one given away via gacha.
  const existing =
    CATALOG[it.itemKey].type === "unique"
      ? null
      : panel.items.find(
          (i) =>
            i.itemKey === it.itemKey &&
            i.detail === (it.detail || null) &&
            i.note === (it.note || null) &&
            !!i.notForSale === !!it.notForSale,
        );
  if (existing) {
    existing.qty += it.qty;
    return;
  }

  const base = { itemKey: it.itemKey, price: null, detail: it.detail || null, note: it.note || null, notForSale: !!it.notForSale };
  if (CATALOG[it.itemKey].type === "unique" && it.qty > 1) {
    // "thorns x2" in one line still means two distinct drops — one row each.
    for (let n = 0; n < it.qty; n++) panel.items.push({ ...base, qty: 1 });
  } else {
    panel.items.push({ ...base, qty: it.qty });
  }
}

async function handleAddItemsModal(interaction) {
  // customId: loot-modal:add_items:{lootMsgId}
  const lootMsgId = interaction.customId.split(":")[2];

  const panel = activeLootPanels[lootMsgId];
  if (!panel || panel.closed) {
    return interaction.reply({ content: "❌ Loot panel not found.", flags: MessageFlags.Ephemeral });
  }
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can add items.", flags: MessageFlags.Ephemeral });
  }

  const { added, golds, unresolved, errors } = parseItemLines(interaction.fields.getTextInputValue("items"));

  // What the parser could not read, kept so the vocabulary gets tuned against
  // real input. A line that needed a click is recorded too, separately: one
  // repeated often enough is a default the parser should be making itself.
  for (const e of errors) recordParseFail("loot", e.raw, e.reason, interaction.user.id);
  for (const u of unresolved)
    recordParseFail("loot", u.raw, u.reason || "needed a choice", interaction.user.id, "needs_pick");

  for (const it of added) addToPanel(panel, it);

  // Resolve gold ÷7 exclusions (@name → panel member) and collect warnings.
  const goldWarnings = [];
  if (golds.length) {
    const nameOf = {};
    for (const uid of panel.members) {
      let dn = uid;
      try { dn = (await interaction.guild.members.fetch(uid)).displayName; } catch { /* keep id */ }
      nameOf[uid] = dn;
    }
    // Against the party, not against 7. A seven-man run types `/6` for the same
    // HC drop an eight-man run types `/7` for, and both need the same question:
    // who is left out. Splitting more ways than there are people is a typo, and
    // saying so beats storing gold that gets paid to fewer people than it names.
    const size = require("../../builders/lootPanel").partySize(panel);
    for (const g of golds) {
      let excludedUserId = null;
      if (g.splitCount > size) {
        goldWarnings.push(`\`${g.amount}/${g.splitCount}\` — cuma ada ${size} orang di panel ini`);
      } else if (g.splitCount < size) {
        const shown = `${g.amount}/${g.splitCount}`;
        if (!g.excludeName) {
          goldWarnings.push(`\`${shown}\` — tag the excluded member, e.g. \`${shown} @name\``);
        } else {
          const exact = panel.members.filter((uid) => nameOf[uid].toLowerCase() === g.excludeName);
          const hits = exact.length ? exact : panel.members.filter((uid) => nameOf[uid].toLowerCase().includes(g.excludeName));
          if (hits.length === 1) excludedUserId = hits[0];
          else if (hits.length === 0) goldWarnings.push(`\`${shown}\` — no member matches \`@${g.excludeName}\``);
          else goldWarnings.push(`\`${shown}\` — \`@${g.excludeName}\` is ambiguous (${hits.length} members)`);
        }
      }
      panel.goldEntries.push({
        amount: g.amount,
        splitCount: g.splitCount,
        excludedUserId,
        bonusSource: !!g.bonusSource,
      });
    }
  }

  if (added.length || golds.length) saveState();

  const lines = [];
  if (added.length) {
    lines.push(`✅ Added ${added.length} item(s):`);
    for (const it of added) {
      const def = CATALOG[it.itemKey];
      const d = it.detail ? ` (${it.detail})` : "";
      const gacha = it.notForSale ? " 🎁 (gacha, tidak dijual)" : "";
      lines.push(`• ${def.name}${d} ×${it.qty}${gacha}`);
    }
  }
  if (golds.length) {
    lines.push(`${lines.length ? "\n" : ""}💰 Added ${golds.length} gold drop(s):`);
    for (const g of panel.goldEntries.slice(-golds.length)) {
      const per = Math.floor(g.amount / g.splitCount).toLocaleString();
      const excl = g.excludedUserId ? `, <@${g.excludedUserId}> excluded` : "";
      // Echoed back so a "!" that did not register is visible immediately, not
      // at payout time when the split is already wrong.
      const src = g.bonusSource ? " 🎁 sumber bonus" : "";
      lines.push(`• ${g.amount.toLocaleString()} ÷${g.splitCount}${excl} = ${per}/person${src}`);
    }
  }
  if (goldWarnings.length) {
    lines.push(`${lines.length ? "\n" : ""}⚠️ Gold needs attention:`);
    for (const w of goldWarnings) lines.push(`• ${w}`);
  }
  if (errors.length) {
    lines.push(`${lines.length ? "\n" : ""}⚠️ Couldn't match ${errors.length} line(s):`);
    // The parser is the only place that knows why, and formatParseError is the
    // one place that words it — so /parse-fails and this reply cannot drift.
    for (const e of errors) lines.push(`• ${formatParseError(e)}`);
  }

  const components = [];
  if (unresolved.length) {
    setPendingResolution(lootMsgId, interaction.user.id, unresolved);
    lines.push(`${lines.length ? "\n" : ""}❓ ${unresolved.length} line(s) need a choice — click **Resolve** and type one number per line (comma-separated):`);
    unresolved.forEach((u, i) => {
      // The reason IS the question the list is asking — "which tier?" — and a
      // bare pair of accessories does not ask it.
      lines.push(`\n**[${i + 1}]** \`${u.raw}\`${u.reason ? ` — ${u.reason}` : ""}`);
      u.candidates.forEach((c, j) => {
        const meta = [c.class, c.part].filter(Boolean).join(", ");
        lines.push(`  ${j + 1}) ${c.name}${meta ? ` (${meta})` : ""}`);
      });
    });
    lines.push(`\n_e.g._ \`${unresolved.map(() => "1").join(", ")}\`  (0 to skip a line)`);

    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`loot-btn:resolve_items:${lootMsgId}`)
          .setLabel("Resolve")
          .setStyle(ButtonStyle.Primary),
      ),
    );
  }

  if (!lines.length) lines.push("Nothing to add.");

  await interaction.reply({
    content: lines.join("\n").slice(0, 2000),
    components,
    flags: MessageFlags.Ephemeral,
  });
  if (added.length || golds.length) await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleAddItemsModal, addToPanel };
