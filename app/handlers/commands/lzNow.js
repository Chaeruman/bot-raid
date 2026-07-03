const { MessageFlags } = require("discord.js");
const config = require("../../config");
const { isCoLeader } = require("../../utils/coleader");
const { setLzDigestLastSent } = require("../../state");
const { sendLzDigest } = require("../../lzDigest");

// Manual trigger — mitigation for the daily 08:00 WIB post getting skipped
// (e.g. Render restart landing on the window).
async function handleLzNow(interaction) {
  if (!isCoLeader(interaction)) {
    return interaction.reply({ content: "⛔ Only Co-Leaders can use this.", flags: MessageFlags.Ephemeral });
  }
  if (!config.lzChannelId) {
    return interaction.reply({ content: "⚠️ LZ_CHANNEL_ID belum di-set.", flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await sendLzDigest(interaction.client);
  setLzDigestLastSent(Date.now());
  return interaction.editReply(`📬 Lucky Zone terkirim ke <#${config.lzChannelId}>.`);
}

module.exports = { handleLzNow };
