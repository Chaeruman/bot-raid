const {
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");

// The game mails 36g for HC and 36g for Classic. When one of those mails never
// arrives, the missing gold is sent by hand — bundled into the salary rather
// than as a separate transfer, so it costs the seller one mail instead of two.
// 36 is therefore the answer nearly every time, which is why it is the default
// and why the field is optional.
const BONUS_DEFAULT = 36;

// A native user-select searches the whole guild. The people who can be owed this
// are exactly the panel's members, so the list is built from those instead —
// a bonus aimed at someone who was never on the run is not a case worth allowing.
async function memberOptions(interaction, panel) {
  const bonuses = panel.bonuses || {};
  return Promise.all(
    panel.members.map(async (uid) => {
      let label = uid;
      try {
        label = (await interaction.guild.members.fetch(uid)).displayName;
      } catch {
        // fallback to the id
      }
      const current = bonuses[uid];
      return {
        label: label.slice(0, 100),
        value: uid,
        // Nobody is pre-selected on purpose: submitting SETS the amount, and a
        // pre-ticked list would overwrite three different bonuses with one number.
        description: current ? `sekarang +${current.toLocaleString()}g` : "belum ada bonus",
      };
    }),
  );
}

async function handleBonusGold(interaction, panel) {
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can set bonus gold.", flags: MessageFlags.Ephemeral });
  }
  if (!panel.members.length) {
    return interaction.reply({
      content: "⚠️ Belum ada member di panel ini — tambah member dulu.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const options = await memberOptions(interaction, panel);

  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:bonus_gold:${panel.lootMsgId}`)
    .setTitle("Bonus gold")
    .setLabelComponents(
      new LabelBuilder()
        .setLabel("Siapa yang dapat bonus")
        .setDescription("Bisa pilih lebih dari satu")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId("members")
            .setRequired(true)
            .setPlaceholder("Pilih member")
            .setMinValues(1)
            .setMaxValues(Math.min(options.length, 25))
            .addOptions(options),
        ),
      new LabelBuilder()
        .setLabel("Jumlah gold per orang")
        .setDescription(`Kosongkan = ${BONUS_DEFAULT}. Isi 0 untuk menghapus bonus.`)
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("amount")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(String(BONUS_DEFAULT))
            .setRequired(false)
            .setMaxLength(9),
        ),
    );

  return interaction.showModal(modal);
}

module.exports = { handleBonusGold, BONUS_DEFAULT };
