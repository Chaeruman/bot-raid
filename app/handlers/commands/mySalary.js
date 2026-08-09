const { MessageFlags } = require("discord.js");
const { getSalaryLog } = require("../../state");
const { rangeOf } = require("../../salaryRange");

async function handleMySalary(interaction, range = interaction.options?.getString("range") || "week") {
  const { label, since: sinceOf } = rangeOf(range);
  const since = sinceOf();

  const rows = await getSalaryLog(interaction.user.id, since);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  if (rows.length === 0) {
    return interaction.reply({
      content: `💰 Belum ada gaji tercatat ${label}.`,
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

  const content = `💰 Total gaji kamu (${label}): **${total.toLocaleString()}g**\n\n${list.join("\n")}${more}`;
  return interaction.reply({ content: content.slice(0, 2000), flags: MessageFlags.Ephemeral });
}

module.exports = { handleMySalary };
