const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");
const { allItemsSold } = require("../../../builders/lootPanel");

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
      .setPlaceholder("Select member(s) to toggle payment")
      .setMinValues(1)
      .setMaxValues(Math.min(panel.members.length, 25))
      .addOptions(options),
  );
}

async function handleMarkPaid(interaction, panel) {
  if (interaction.user.id !== panel.hostId && interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the host or seller can mark payments.", flags: MessageFlags.Ephemeral });
  }
  if (!allItemsSold(panel)) {
    return interaction.reply({
      content: "⚠️ Selesaikan pricing semua item dulu (atau pastikan ada gold raid) sebelum mark paid — supaya gaji yang tercatat nggak basi kalau nanti nambah item lagi.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const row = await buildMarkPaidRow(interaction, panel);
  await interaction.reply({
    content: "💳 **Mark Paid** — select member to toggle (you can toggle several):",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleMarkPaid, buildMarkPaidRow };
