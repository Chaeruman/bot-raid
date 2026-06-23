const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");

async function buildMarkPaidRow(interaction, panel) {
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
      };
    }),
  );

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:mark_paid:${panel.lootMsgId}`)
      .setPlaceholder("Select member to toggle payment status")
      .addOptions(options),
  );
}

async function handleMarkPaid(interaction, panel) {
  if (interaction.user.id !== panel.hostId) {
    return interaction.reply({ content: "⛔ Only the host can mark payments.", flags: MessageFlags.Ephemeral });
  }

  const row = await buildMarkPaidRow(interaction, panel);
  await interaction.reply({
    content: "💳 **Mark Paid** — select member to toggle (you can toggle several):",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleMarkPaid, buildMarkPaidRow };
