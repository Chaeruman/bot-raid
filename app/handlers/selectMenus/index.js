const { handleRemoveMemberSelect } = require("./removeMember");
const { handleSubRoleSelect } = require("./subRoleSelect");
const { handleLootSelect } = require("./loot");
const { handleCombinedPaySelect } = require("../commands/combinedPay");
const { handleBountyCharSelect } = require("../commands/bountyQuest");

async function handleSelectMenu(interaction) {
  if (interaction.customId.startsWith("bounty-fin:pick:")) {
    return require("../../bountyJoin").handleCharPick(interaction);
  }
  if (interaction.customId.startsWith("bounty-sel:quest-char")) {
    return handleBountyCharSelect(interaction);
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
  if (interaction.customId.startsWith("select_subrole_")) {
    return handleSubRoleSelect(interaction);
  }
}

module.exports = { handleSelectMenu };
