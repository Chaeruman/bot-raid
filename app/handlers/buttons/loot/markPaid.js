const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { setPendingEphemeral } = require("../../../state");

async function handleMarkPaid(interaction, panel) {
  if (interaction.user.id !== panel.hostId) {
    return interaction.reply({ content: "⛔ Only the host can mark payments.", flags: MessageFlags.Ephemeral });
  }

  const options = await Promise.all(
    panel.members.map(async (uid) => {
      let label = uid;
      try {
        const member = await interaction.guild.members.fetch(uid);
        label = member.displayName;
      } catch {
        // fallback to ID
      }
      const paid = panel.payments[uid];
      return {
        label: label.slice(0, 100),
        value: uid,
        description: paid ? "✅ Paid" : "❌ Not paid",
        default: paid,
      };
    }),
  );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:mark_paid:${panel.lootMsgId}`)
      .setPlaceholder("Select member to toggle payment status")
      .addOptions(options),
  );

  await interaction.reply({
    content: "💳 **Mark Paid** — select member to toggle:",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
  setPendingEphemeral(panel.lootMsgId, interaction.user.id, interaction);
}

module.exports = { handleMarkPaid };
