const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { activeLootPanels, saveState, setPendingResolution } = require("../../state");
const { CATALOG } = require("../../items");
const { refreshLootPanel } = require("../../builders/lootPanel");
const { parseItemLines } = require("../../utils/parseItems");

function addToPanel(panel, it) {
  const existing = panel.items.find((i) => i.itemKey === it.itemKey && i.detail === (it.detail || null));
  if (existing) existing.qty += it.qty;
  else panel.items.push({ itemKey: it.itemKey, qty: it.qty, price: null, detail: it.detail || null });
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
    for (const g of golds) {
      let excludedUserId = null;
      if (g.splitCount === 7) {
        if (!g.excludeName) {
          goldWarnings.push(`\`${g.amount}/7\` — tag the excluded member, e.g. \`${g.amount}/7 @name\``);
        } else {
          const hits = panel.members.filter((uid) => nameOf[uid].toLowerCase().includes(g.excludeName));
          if (hits.length === 1) excludedUserId = hits[0];
          else if (hits.length === 0) goldWarnings.push(`\`${g.amount}/7\` — no member matches \`@${g.excludeName}\``);
          else goldWarnings.push(`\`${g.amount}/7\` — \`@${g.excludeName}\` is ambiguous (${hits.length} members)`);
        }
      }
      panel.goldEntries.push({ amount: g.amount, splitCount: g.splitCount, excludedUserId });
    }
  }

  if (added.length || golds.length) saveState();

  const lines = [];
  if (added.length) {
    lines.push(`✅ Added ${added.length} item(s):`);
    for (const it of added) {
      const def = CATALOG[it.itemKey];
      const d = it.detail ? ` (${it.detail})` : "";
      lines.push(`• ${def.name}${d} ×${it.qty}`);
    }
  }
  if (golds.length) {
    lines.push(`${lines.length ? "\n" : ""}💰 Added ${golds.length} gold drop(s):`);
    for (const g of panel.goldEntries.slice(-golds.length)) {
      const per = Math.floor(g.amount / g.splitCount).toLocaleString();
      const excl = g.excludedUserId ? `, <@${g.excludedUserId}> excluded` : "";
      lines.push(`• ${g.amount.toLocaleString()} ÷${g.splitCount}${excl} = ${per}/person`);
    }
  }
  if (goldWarnings.length) {
    lines.push(`${lines.length ? "\n" : ""}⚠️ Gold needs attention:`);
    for (const w of goldWarnings) lines.push(`• ${w}`);
  }
  if (errors.length) {
    lines.push(`${lines.length ? "\n" : ""}⚠️ Couldn't match ${errors.length} line(s):`);
    for (const e of errors) lines.push(`• \`${e}\``);
  }

  const components = [];
  if (unresolved.length) {
    setPendingResolution(lootMsgId, interaction.user.id, unresolved);
    lines.push(`${lines.length ? "\n" : ""}❓ ${unresolved.length} line(s) need a choice — click **Resolve** and type one number per line (comma-separated):`);
    unresolved.forEach((u, i) => {
      lines.push(`\n**[${i + 1}]** \`${u.raw}\``);
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

module.exports = { handleAddItemsModal };
