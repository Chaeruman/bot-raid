const { MessageFlags } = require("discord.js");
const { activeLootPanels, saveState } = require("../../state");
const { refreshLootPanel, memberSalary } = require("../../builders/lootPanel");
const { BONUS_DEFAULT } = require("../buttons/loot/bonusGold");

async function handleBonusGoldModal(interaction) {
  // customId: loot-modal:bonus_gold:{lootMsgId}
  const lootMsgId = interaction.customId.split(":")[2];

  const panel = activeLootPanels[lootMsgId];
  if (!panel || panel.closed) {
    return interaction.reply({ content: "❌ Loot panel not found.", flags: MessageFlags.Ephemeral });
  }
  if (interaction.user.id !== panel.sellerId) {
    return interaction.reply({ content: "⛔ Only the seller can set bonus gold.", flags: MessageFlags.Ephemeral });
  }

  const uids = interaction.fields.getStringSelectValues("members");
  const raw = (interaction.fields.getTextInputValue("amount") || "").trim().replace(/,/g, "");
  // Checked as a STRING: parseInt("36abc") is 36, and quietly accepting that
  // pays a number nobody typed.
  if (raw !== "" && !/^\d+$/.test(raw)) {
    return interaction.reply({
      content: `❌ Jumlah gold tidak valid. Isi angka bulat ≥ 0, atau kosongkan untuk ${BONUS_DEFAULT}.`,
      flags: MessageFlags.Ephemeral,
    });
  }
  // Blank is the common case, which is the whole reason there is a default.
  const amount = raw === "" ? BONUS_DEFAULT : parseInt(raw, 10);

  // SET, not add. A modal can be submitted twice by a slow connection, and an
  // accumulating version would silently double someone's money with no trace.
  // Setting the same number twice changes nothing, and 0 is how a bonus is undone.
  if (!panel.bonuses) panel.bonuses = {};
  for (const uid of uids) {
    if (amount === 0) delete panel.bonuses[uid];
    else panel.bonuses[uid] = amount;
  }
  saveState();

  // The RESULTING salary, not the delta — that is the number that will actually
  // be mailed, and it is the only one worth checking against.
  const lines = [
    amount === 0
      ? `🎁 Bonus dihapus untuk ${uids.length} orang:`
      : `🎁 Bonus **${amount.toLocaleString()}g/orang** untuk ${uids.length} orang:`,
  ];
  for (const uid of uids) {
    lines.push(`• <@${uid}> — gaji jadi **${memberSalary(panel, uid).toLocaleString()}g**`);
  }
  if (amount > 0) lines.push("", "_Bonus kena mail tax 0.3% sama seperti komponen gaji lain._");

  await interaction.reply({
    content: lines.join("\n").slice(0, 2000),
    allowedMentions: { parse: [] }, // a payout note should not ping eight people
    flags: MessageFlags.Ephemeral,
  });
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleBonusGoldModal };
