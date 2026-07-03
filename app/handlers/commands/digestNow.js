const { MessageFlags } = require("discord.js");
const config = require("../../config");
const { isCoLeader } = require("../../utils/coleader");
const { setDigestLastSent } = require("../../state");
const { sendWeeklyDigest } = require("../../digest");

// Manual trigger — mitigation for scheduled sends getting skipped (e.g. Render
// maintenance restart landing on the digest window).
async function handleDigestNow(interaction) {
  if (!isCoLeader(interaction)) {
    return interaction.reply({ content: "⛔ Only Co-Leaders can use this.", flags: MessageFlags.Ephemeral });
  }
  if (!config.digestChannelId) {
    return interaction.reply({ content: "⚠️ DIGEST_CHANNEL_ID belum di-set.", flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const count = await sendWeeklyDigest(interaction.client);
  setDigestLastSent(Date.now());
  return interaction.editReply(
    count > 0
      ? `📬 Weekly digest terkirim ke <#${config.digestChannelId}> (${count} entri).`
      : "🤷 Belum ada gaji tercatat di salaryLog 7 hari terakhir — nggak ada yang diposting.",
  );
}

module.exports = { handleDigestNow };
