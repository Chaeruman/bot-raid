const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require("discord.js");

async function handleRemoveMember(interaction, panel) {
  if (interaction.user.id !== panel.hostId) {
    return interaction.reply({ content: "⛔ Only the host can manage members.", flags: MessageFlags.Ephemeral });
  }

  if (panel.members.length === 0) {
    return interaction.reply({ content: "❌ No members to remove.", flags: MessageFlags.Ephemeral });
  }

  const options = await Promise.all(
    panel.members.map(async (uid) => {
      let label = uid;
      try {
        const member = await interaction.guild.members.fetch(uid);
        label = member.displayName;
      } catch { /* fallback to ID */ }
      return {
        label: label.slice(0, 100),
        value: uid,
        description: panel.payments[uid] ? "✅ Paid" : "❌ Not paid",
      };
    }),
  );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:remove_member:${panel.lootMsgId}`)
      .setPlaceholder("Select member(s) to remove…")
      .setMinValues(1)
      .setMaxValues(Math.min(panel.members.length, 25))
      .addOptions(options),
  );

  await interaction.reply({
    content: "➖ **Remove Member** — select one or more:",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleRemoveMember };
