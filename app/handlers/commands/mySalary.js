const { MessageFlags } = require("discord.js");
const { getSalaryLog } = require("../../state");

const RANGES = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 };

async function handleMySalary(interaction) {
  const range = interaction.options.getString("range") || "7d";
  const days = RANGES[range];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await getSalaryLog(interaction.user.id, since);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  if (rows.length === 0) {
    return interaction.reply({
      content: `💰 Belum ada gaji tercatat dalam ${days} hari terakhir.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const list = await Promise.all(
    rows.slice(0, 25).map(async (r) => {
      let sellerName = r.sellerId || "?";
      try {
        sellerName = (await interaction.guild.members.fetch(r.sellerId)).displayName;
      } catch { /* fallback to id */ }
      const link = r.threadId
        ? `[${r.panelTitle || r.panelId}](https://discord.com/channels/${interaction.guildId}/${r.threadId}/${r.panelId})`
        : r.panelTitle || r.panelId;
      return `• ${link} — **${r.amount.toLocaleString()}g** dari **${sellerName}**`;
    }),
  );
  const more = rows.length > 25 ? `\n…dan ${rows.length - 25} lainnya` : "";

  const content = `💰 Total gaji kamu (${days} hari terakhir): **${total.toLocaleString()}g**\n\n${list.join("\n")}${more}`;
  return interaction.reply({ content: content.slice(0, 2000), flags: MessageFlags.Ephemeral });
}

module.exports = { handleMySalary };
