const { MessageFlags } = require("discord.js");
const { getParseFails, clearParseFails } = require("../../state");
const { isCoLeader } = require("../../utils/coleader");

// What people typed that the parsers could not read. The point of this command
// is to be COPY-PASTEABLE: the output is a plain code block of raw lines, so a
// batch can be handed straight to whoever is tuning the vocabulary without
// anyone retyping or screenshotting it.
const ICON = { failed: "❌", needs_pick: "❓" };

async function handleParseFails(interaction) {
  if (!isCoLeader(interaction)) {
    return interaction.reply({ content: "⛔ Only Co-Leaders can use this.", flags: MessageFlags.Ephemeral });
  }

  const source = interaction.options.getString("source") || null;
  const outcome = interaction.options.getString("outcome") || null;

  // Deleting is never the default and never partial-by-accident: it clears
  // exactly the source asked for, and says how many rows went.
  if (interaction.options.getBoolean("clear")) {
    const n = await clearParseFails(source);
    return interaction.reply({
      content: `🧹 ${n} baris gagal dihapus${source ? ` (source: \`${source}\`)` : ""}.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const rows = await getParseFails({ source, outcome, limit: 40 });
  if (!rows.length) {
    return interaction.reply({
      content: "✅ Belum ada baris yang gagal di-parse (atau MongoDB belum tersambung).",
      flags: MessageFlags.Ephemeral,
    });
  }

  const failed = rows.filter((r) => r.outcome === "failed").length;
  const header =
    `📝 **Parse failures** — ${rows.length} baris berbeda ` +
    `(${failed} gagal total, ${rows.length - failed} butuh klik). Terbanyak dulu.`;

  // The reason belongs in the block too: it is the parser's own account of what
  // went wrong, and reading the list without it is guessing twice over.
  const block = rows
    .map((r) => `${ICON[r.outcome] || "•"} ${String(r.count).padStart(3)}x [${r.source}] ${r.line}\n        ↳ ${r.reason}`)
    .join("\n");

  const body = `${header}\n\`\`\`\n${block}\n\`\`\``;
  // A long list is truncated rather than dropped — 2000 chars is Discord's, not
  // ours, and the rows are already ordered by how much each one matters.
  const content =
    body.length <= 2000
      ? body
      : `${body.slice(0, 1980).replace(/\n[^\n]*$/, "")}\n…\n\`\`\``;

  return interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

module.exports = { handleParseFails };
