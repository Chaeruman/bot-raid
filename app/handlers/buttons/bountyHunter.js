// Granting the Bounty Hunter role from the request itself.
//
// The bot spent its whole life not needing Manage Roles, and that was the right
// default — it still works without it. This is the one place that uses it, and
// its reach is exactly one role: Discord refuses to manage anything at or above
// the bot's own highest role, so the bot sitting one rung above Bounty Hunter
// can grant that and nothing else.
const { MessageFlags, PermissionFlagsBits } = require("discord.js");
const config = require("../../config");
const { bountyApplications, saveState } = require("../../state");

const PREFIX = "bounty-hunter:"; // + <approve|decline>:<applicantId>

const ephemeral = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral });

async function handleHunterDecision(interaction) {
  const [verb, applicantId] = interaction.customId.slice(PREFIX.length).split(":");

  // Whoever may hand out roles may decide this. Checking the permission rather
  // than a named role means it keeps working when the staff list changes.
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles))
    return ephemeral(interaction, "⛔ Butuh izin **Manage Roles** buat memutuskan ini.");

  const close = (line) =>
    interaction.update({ content: line, components: [], allowedMentions: { parse: [] } });

  if (verb === "decline") {
    delete bountyApplications[applicantId];
    saveState();
    return close(`✖️ Pengajuan <@${applicantId}> ditolak oleh <@${interaction.user.id}>.`);
  }

  const member = await interaction.guild.members.fetch(applicantId).catch(() => null);
  if (!member) return ephemeral(interaction, "⚠️ Orangnya sudah tidak ada di server.");

  const failed = await member.roles.add(config.bountyHunterRoleId).catch((err) => err);
  if (failed instanceof Error) {
    console.error(`❌ grant Bounty Hunter → ${applicantId}:`, failed.message);
    return ephemeral(
      interaction,
      "⚠️ Bot tidak bisa memasang role itu. Cek **Manage Roles**, dan pastikan role bot berada " +
        "**di atas** Bounty Hunter di Server Settings → Roles — Discord menolak mengelola role " +
        "yang sederajat atau lebih tinggi dari role bot sendiri.",
    );
  }

  delete bountyApplications[applicantId];
  saveState();

  // The thread is the whole point of having asked, and they are not here to
  // press anything — this is the moment it can just appear in their sidebar.
  // A failure here does not undo the approval; they can still press the button.
  const thread = await require("../../bountyThread")
    .threadFor(interaction.client, applicantId, member.displayName || member.user?.username || applicantId)
    .catch((err) => {
      console.error(`❌ thread for approved hunter ${applicantId}:`, err.message);
      return null;
    });

  return close(
    `✅ <@${applicantId}> jadi Bounty Hunter — disetujui <@${interaction.user.id}>.` +
      (thread ? ` Thread-nya sudah dibuat.` : ""),
  );
}

module.exports = { handleHunterDecision, PREFIX };
