// Answering an ambiguous quest line by picking from a shortlist.
//
// The chosen option carries the whole quest — pool, rarity, scroll, card box —
// so nothing was stored while the menu sat there waiting. No pending table, so
// nothing to expire, and a menu left unanswered for a week costs nothing.
const { MessageFlags } = require("discord.js");
const { questLabel } = require("../../bounty");
const { addQuests, FIX } = require("../modals/bountyQuest");

async function handleQuestFix(interaction) {
  // Index first, name last: character names may contain ":", and putting the
  // name at the end means it survives however it is spelled.
  const charName = interaction.customId.slice(FIX.length).split(":").slice(1).join(":");
  const [poolKey, rarity, scroll, box] = interaction.values[0].split("|");
  const quest = { poolKey, rarity, scroll, box: box === "1" };

  const userId = interaction.user.id;
  const { saved, repeats, overflow, stored } = await addQuests(userId, charName, [quest]);

  if (!stored)
    return interaction.reply({
      content: "⚠️ Database tidak tersambung — tidak ada yang tersimpan.",
      flags: MessageFlags.Ephemeral,
    });

  const line = saved.length
    ? `✅ **${charName}** — ${questLabel(quest)}`
    : repeats.length
      ? `↩️ Sudah ada di board **${charName}**.`
      : overflow.length
        ? `⚠️ Board **${charName}** sudah penuh — quest ini tidak masuk.`
        : `Tidak ada yang berubah.`;

  if (saved.length) {
    require("../../bountyBoard").syncBoard(interaction.client).catch(() => {});
    require("../../bountyThread").refreshThread(interaction.client, userId).catch(() => {});
  }

  // Drop the menu that was just answered. Leaving it would invite a second pick
  // that silently does nothing, since the quest is already on the board.
  const rest = interaction.message.components.filter(
    (row) => row.components[0]?.customId !== interaction.customId,
  );
  return interaction.update({ content: line, components: rest });
}

module.exports = { handleQuestFix };
