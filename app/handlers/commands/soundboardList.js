const { MessageFlags, Routes } = require("discord.js");
const { isCoLeader } = require("../../utils/coleader");

// One-off setup helper: lists this guild's custom soundboard sounds with
// their IDs, since Discord's client UI never shows the raw sound_id.
async function handleSoundboardList(interaction) {
  if (!isCoLeader(interaction)) {
    return interaction.reply({ content: "⛔ Only Co-Leaders can use this.", flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const data = await interaction.client.rest.get(Routes.guildSoundboardSounds(interaction.guildId));
  const sounds = data.items || data;

  if (!sounds.length) {
    return interaction.editReply(
      "🔇 Belum ada soundboard sound custom di server ini. Upload dulu di Server Settings → Soundboard, lalu jalanin command ini lagi.",
    );
  }

  const lines = sounds.map((s) => `• **${s.name}** — \`${s.sound_id}\``);
  return interaction.editReply(lines.join("\n").slice(0, 2000));
}

module.exports = { handleSoundboardList };
