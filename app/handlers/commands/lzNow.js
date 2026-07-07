const { MessageFlags } = require("discord.js");
const config = require("../../config");
const { isCoLeader } = require("../../utils/coleader");
const { sendLzDigest } = require("../../lzDigest");

// Manual trigger — just an on-demand post, doesn't touch the scheduler's
// last-sent guard. Touching it here would suppress the next automatic post
// for ~23h every time someone manually checks, masking a real scheduling bug
// behind an apparent "it's working, I just triggered it" false positive.
async function handleLzNow(interaction) {
  if (!isCoLeader(interaction)) {
    return interaction.reply({ content: "⛔ Only Co-Leaders can use this.", flags: MessageFlags.Ephemeral });
  }
  if (!config.lzChannelId) {
    return interaction.reply({ content: "⚠️ LZ_CHANNEL_ID belum di-set.", flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await sendLzDigest(interaction.client);
  return interaction.editReply(`📬 Lucky Zone terkirim ke <#${config.lzChannelId}>.`);
}

module.exports = { handleLzNow };
