const { handleRemoveMemberSelect } = require("./removeMember");
const { handleLootSelect } = require("./loot");
const { handleCombinedPaySelect } = require("../commands/combinedPay");

async function handleSelectMenu(interaction) {
  if (interaction.customId.startsWith("bounty-mark:")) {
    return require("./bountyMark").handleMark(interaction);
  }
  if (interaction.customId.startsWith("bounty-fix:")) {
    return require("./bountyFix").handleQuestFix(interaction);
  }
  if (interaction.customId.startsWith("bounty-fin:pick:")) {
    return require("../../bountyJoin").handleCharPick(interaction);
  }
  if (interaction.customId.startsWith("gab:")) {
    return handleCombinedPaySelect(interaction);
  }
  if (interaction.customId.startsWith("loot-sel:")) {
    return handleLootSelect(interaction);
  }
  if (interaction.customId.startsWith("select_remove_")) {
    return handleRemoveMemberSelect(interaction);
  }
}

module.exports = { handleSelectMenu };
